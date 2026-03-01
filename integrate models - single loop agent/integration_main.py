import os
import asyncio
import uuid
import json
from typing import List, Dict, Any, Optional
import chromadb
from ollama_helper import OllamaClient

# Import RAG pipeline
try:
    import rag_chroma
    print("Successfully imported rag_chroma")
except Exception as e:
    print(f"Error importing rag_chroma: {e}")
    raise

# --- Global Agent Cache (shifted to Ollama) ---
_agent_cache = {
    "initialized": False,
    "embedding_model": None,
    "client": None,
    "collection": None,
    "ollama": None,
    "ingested_pdfs": set()
}

def _initialize_agents_once():
    """Initialize components once and cache them"""
    global _agent_cache
    
    if _agent_cache["initialized"]:
        return
    
    print("[Cache] Initializing components (one-time setup for Ollama)...")
    
    # Initialize RAG components
    _agent_cache["embedding_model"] = rag_chroma.get_embedding_model()
    
    try:
        print("[Cache] Connecting to ChromaDB...")
        _agent_cache["client"] = chromadb.PersistentClient(path="./chroma_store")
        _agent_cache["client"].list_collections()
        print("[Cache] Connected to ChromaDB successfully.")
    except Exception as e:
        print(f"[Cache] Error connecting to ChromaDB: {e}")
        raise e

    collection_name = getattr(rag_chroma, "COLLECTION_NAME", "student_notes_local")
    _agent_cache["collection"] = _agent_cache["client"].get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )
    
    # Initialize Ollama Client
    _agent_cache["ollama"] = OllamaClient(model="llama3.1:8b")
    _agent_cache["initialized"] = True
    print("[Cache] Components initialized!")

# --- API-Compatible Processing Function ---
async def process_question(pdf_url: str, question: str, output_mode: str, learning_level: int = 3, language: str = "en") -> dict:
    """
    Standard synchronous version (returns full text)
    """
    result = {"content": ""}
    async for chunk in process_question_stream(pdf_url, question, output_mode, learning_level, language):
        if isinstance(chunk, dict):
            if "content" in chunk:
                result["content"] += chunk["content"]
            result.update(chunk)
        else:
            result["content"] += chunk
    return result

async def process_question_stream(pdf_url: str, question: str, output_mode: str, learning_level: int = 3, language: str = "en"):
    """
    Process a student question with streaming and source attribution
    """
    try:
        print(f"\n[Process] Initializing for PDF: {pdf_url[:50]}...")
        _initialize_agents_once()
        
        effective_level = 3 if output_mode == "interactive" else learning_level
        
        embedding_model = _agent_cache["embedding_model"]
        collection = _agent_cache["collection"]
        ollama_client = _agent_cache["ollama"]
        
        # Ingest PDF
        if pdf_url not in _agent_cache["ingested_pdfs"]:
            print(f"[Process] Ingesting PDF (first time)...")
            rag_chroma.ingest_local_documents(gdrive_url=pdf_url)
            _agent_cache["ingested_pdfs"].add(pdf_url)
        
        # Query RAG
        results = []
        source_info = "Internet/General Knowledge"
        is_relevant = False
        try:
            pdf_bytes = rag_chroma.download_pdf_from_gdrive(pdf_url)
            pdf_id = rag_chroma.get_pdf_hash_from_bytes(pdf_bytes)
            
            results = rag_chroma.query_chromadb(
                collection, 
                question, 
                embedding_model, 
                top_n=3,
                where={"pdf_id": pdf_id}
            )
            
            if results and len(results) > 0:
                relevance_score = results[0].get('hybrid_score', 0)
                if relevance_score > 0.4:
                    is_relevant = True
                    source_name = results[0].get('metadata', {}).get('source', 'Course Material')
                    source_info = f"Course Material ({source_name})"
        except Exception as e:
            print(f"[Process] Error querying ChromaDB: {e}")

        # Handle generic greetings
        generic_patterns = ["hi", "hello", "hey", "who are you"]
        if not is_relevant and any(p in question.lower() for p in generic_patterns):
            yield {
                "success": True,
                "type": "text",
                "content": "Hello! I'm your AI tutor. I can help you with questions based on your uploaded PDFs. What would you like to know?",
                "source": "System",
                "audioUrl": None
            }
            return

        # Adaptive Tutor Guidelines
        level_guidelines = {
            1: "Use very simple words, step-by-step breakdown, many small examples, frequent checks, and slow pacing. Avoid jargon.",
            2: "Use simple explanations, examples, analogies, and guided steps.",
            3: "Standard explanation with moderate detail and occasional examples.",
            4: "Concise, concept-focused explanation with minimal examples.",
            5: "Abstract explanation using high-level concepts. Challenge the student's thinking."
        }
        
        method_plans = {
            "normal": "DIRECT METHOD: Define the concept clearly, explain how it works, show key steps/rules, give a simple example, and summarize takeaway.",
            "analogy": "ANALOGY METHOD: Map concept to a familiar real-world idea, explain similarity, connect back to real concept, and reinforce understanding.",
            "interactive": "VOICE METHOD: Generate a conversational dialogue between two tutors, 'Male' and 'Female'."
        }
        
        system_instr = f"""You are an adaptive AI tutor.
STUDE LEVEL: {effective_level}/5
GUIDELINES: {level_guidelines.get(effective_level, level_guidelines[3])}
METHOD: {method_plans.get(output_mode, method_plans['normal'])}
SOURCE ATTRIBUTION: Always mention your source is {source_info}.
"""
        if is_relevant:
            context_text = "\n\n".join([r['document'] for r in results])
            system_instr += "\nAnswer using the provided context. If the context is insufficient, supplement with general knowledge but prioritize the context."
            prompt = f"Context:\n{context_text}\n\nQuestion: {question}"
        else:
            system_instr += "\nAnswer from your general knowledge as the PDF doesn't contain this information."
            prompt = f"Student Question: {question}"

        # 1. Yield Source Info metadata first
        yield {
            "success": True,
            "type": "text",
            "source": source_info,
            "is_rag": is_relevant
        }

        # 2. Generate and stream answer
        if output_mode != "interactive":
            print(f"[Process] Generating answer with 3-cycle verification (Mode {output_mode})...")
            verified_answer = await ollama_client.generate_with_verification(prompt, system_instr)
            yield verified_answer
        else:
            # Interactive mode still needs full generation for TTS
            print(f"[Process] Generating full answer for TTS with 3-cycle verification (Mode {output_mode})...")
            answer = await ollama_client.generate_with_verification(prompt, system_instr)
            
            try:
                import translator
                tts_engine = translator.PedagogyEngine()
                audio_files = await tts_engine.process_dialogue(answer, language)
                
                output_filename = f"audio_output/{uuid.uuid4()}.mp3"
                os.makedirs("audio_output", exist_ok=True)
                tts_engine.save_conversation(audio_files, output_filename)
                
                yield {
                    "type": "audio",
                    "content": answer,
                    "audioUrl": f"/audio/{os.path.basename(output_filename)}"
                }
            except Exception as e:
                print(f"[Process] TTS failed: {e}")
                yield {"content": answer, "error": f"TTS failed: {str(e)}"}
        
    except Exception as e:
        print(f"[Process] Error: {e}")
        yield {"success": False, "error": str(e)}

async def main():
    print("\n--- Ollama-Powered RAG Chatbot Running ---")
    _initialize_agents_once()
    while True:
        q = input("\nAsk (or 'exit'): ")
        if q.lower() in ['exit', 'quit']: break
        res = await process_question("Sample SRS.pdf", q, "normal")
        print(f"\nAI: {res['content']}")

if __name__ == "__main__":
    asyncio.run(main())
