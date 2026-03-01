import os
import json
import re
import asyncio
from typing import List, Dict, Any
from ollama_helper import OllamaClient

# Import RAG pipeline
try:
    import rag_chroma
except ImportError:
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    import rag_chroma

# ==============================
# 🚀 MCQ Generation Function
# ==============================

async def generate_mcqs(pdf_url: str, num_questions: int = 5) -> Dict[str, Any]:
    """
    Generate MCQs using RAG and Ollama.
    """
    print(f"\n[MCQ AGENT] generate_mcqs called for {pdf_url} using Ollama")
    try:
        # 1️⃣ Setup Ollama Client
        client_ollama = OllamaClient(model="llama3.1:8b")

        # 2️⃣ Setup Embeddings + Chroma
        print(f"[MCQ AGENT] Getting embedding model from RAG...")
        embedding_model = rag_chroma.get_embedding_model()

        print(f"[MCQ AGENT] Connecting to Chroma...")
        import chromadb
        client = chromadb.PersistentClient(path="./chroma_store")

        collection_name = getattr(
            rag_chroma,
            "COLLECTION_NAME",
            "student_notes_local"
        )

        collection = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

        # 3️⃣ Ingest PDF (if not already) & Get PDF ID
        print(f"[MCQ AGENT] Ingesting document: {pdf_url}")
        rag_chroma.ingest_local_documents(gdrive_url=pdf_url)
        
        # Calculate PDF ID to filter context (prevent cross-course leak)
        pdf_bytes = rag_chroma.download_pdf_from_gdrive(pdf_url)
        pdf_id = rag_chroma.get_pdf_hash_from_bytes(pdf_bytes)

        # 4️⃣ Retrieve context (FILTERED BY PDF ID)
        print(f"[MCQ AGENT] Querying Chroma for context (pdf_id: {pdf_id[:10]}...)...")
        results = rag_chroma.query_chromadb(
            collection,
            "Generate questions about the core concepts in this document",
            embedding_model,
            top_n=10,
            where={"pdf_id": pdf_id}
        )

        if not results:
            print("[MCQ AGENT] ❌ No content found for this PDF")
            return {"success": False, "error": "No content found in this specific PDF"}

        context_text = "\n\n".join([r["document"] for r in results])
        print(f"[MCQ AGENT] Retrieved {len(results)} context chunks")

        system_instruction = """
        You are an academic quiz generation agent. Your task is to generate Multiple Choice Questions based on the provided content.
        
        Rules:
        1. Return ONLY valid JSON.
        2. Follow this structure EXACTLY: 
        {
          "questions": [
            {
              "id": "unique_id_1",
              "question": "The question text?",
              "options": {
                "A": "Option 1 text",
                "B": "Option 2 text",
                "C": "Option 3 text",
                "D": "Option 4 text"
              },
              "correct_answer": "A",
              "topic": "The sub-topic name"
            }
          ]
        }
        3. 'id' must be unique for each question (e.g., q1, q2, q3...).
        4. 'options' MUST be an object with keys A, B, C, D.
        5. 'correct_answer' MUST be the letter (A, B, C, or D), not the text.
        """

        prompt = f"""
        Retrieved Content:
        {context_text}

        IMPORTANT: You MUST generate EXACTLY {num_questions} Multiple Choice Questions from the content above.
        Do NOT generate fewer than {num_questions} questions.
        Each question must have exactly 4 options (A, B, C, D) and 1 correct answer.
        Cover a variety of concepts from the content.
        """

        # 5️⃣ Generate MCQs via Ollama — retry up to 2 times to enforce count
        print(f"[MCQ AGENT] Running Ollama generation (target: {num_questions} questions)...")
        
        mcq_data = None
        for attempt in range(2):
            candidate = await client_ollama.generate_json(prompt, system_instruction)
            
            if "error" in candidate:
                print(f"[MCQ AGENT] ❌ Attempt {attempt+1} failed: {candidate['error']}")
                continue
            
            generated_questions = candidate.get("questions", [])
            print(f"[MCQ AGENT] Attempt {attempt+1}: got {len(generated_questions)} questions")
            
            if len(generated_questions) >= num_questions:
                mcq_data = candidate
                break
            
            # On retry, be even more explicit
            if attempt == 0:
                prompt = f"""
                Retrieved Content:
                {context_text}

                You generated fewer questions than required on the last attempt.
                You MUST generate EXACTLY {num_questions} Multiple Choice Questions.
                Return ONLY JSON. No text before or after the JSON block.
                Each question MUST have id, question, options (A/B/C/D), correct_answer, topic.
                """
                print(f"[MCQ AGENT] Retrying with stricter prompt...")
        
        # Use whatever we got, even if still fewer (best effort)
        if mcq_data is None:
            mcq_data = candidate if 'candidate' in locals() else {"questions": []}

        if "error" in mcq_data:
            print(f"[MCQ AGENT] ❌ Ollama extraction failed: {mcq_data['error']}")
            return {
                "success": False,
                "error": "Failed to generate valid JSON from Ollama",
                "raw": mcq_data.get("raw_content", "")
            }

        print(f"[MCQ AGENT] ✅ Successfully generated {len(mcq_data.get('questions', []))} questions")

        return {
            "success": True,
            "questions": mcq_data.get("questions", [])
        }

    except Exception as e:
        print(f"[MCQ AGENT] ❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


# 📊 Performance Analysis logic
async def analyze_performance(quiz_data: List[Dict[str, Any]], user_answers: Dict[str, str]) -> Dict[str, Any]:
    """
    Analyzes student performance and provides suggestions.
    """
    print("\n[MCQ AGENT] analyze_performance called")
    try:
        ollama_client = OllamaClient(model="llama3.1:8b")
        
        # Prepare data for analysis
        performance_details = []
        correct_count = 0
        total_count = len(quiz_data)
        
        for q in quiz_data:
            q_id = q.get('id')
            user_choice = user_answers.get(q_id)
            correct_choice = q.get('correct_answer')
            is_correct = user_choice == correct_choice
            
            if is_correct: correct_count += 1
            
            performance_details.append({
                "question": q.get('question'),
                "topic": q.get('topic'),
                "user_answer": user_choice,
                "correct_answer": correct_choice,
                "is_correct": is_correct
            })

        percentage = (correct_count / total_count) * 100 if total_count > 0 else 0
        
        system_instruction = """
        You are a learning analytics agent. Analyze the student's MCQ results.
        
        Return STRICT JSON with this structure:
        {
          "score": "X / N",
          "percentage": number,
          "strong_topics": ["topic names"],
          "weak_topics": ["topic names"],
          "strengths_desc": "detailed text about what student knows well",
          "weaknesses_desc": "detailed text about areas for improvement",
          "recommended_topics": [
            { "title": "Topic Name", "description": "Why they should learn this" }
          ],
          "learning_path": [
            { "title": "Topic Name", "steps": ["Step 1", "Step 2"] }
          ],
          "suggestions": "Overall helpful advice"
        }
        """
        
        prompt = f"""
        Student Performance Data:
        Score: {correct_count}/{total_count} ({percentage}%)
        
        Detailed Results:
        {json.dumps(performance_details, indent=2)}
        
        Please provide a deep analysis, recommended topics, and a concrete learning path.
        """
        
        analysis = await ollama_client.generate_json(prompt, system_instruction)
        return analysis

    except Exception as e:
        print(f"[MCQ AGENT] Analysis Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

if __name__ == "__main__":
    async def test():
        test_url = "https://drive.google.com/file/d/1Xy_zRE.../view" 
        result = await generate_mcqs(test_url, 3)
        print(json.dumps(result, indent=2))

    asyncio.run(test())