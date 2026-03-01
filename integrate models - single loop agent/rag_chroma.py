import os
import re
import fitz  # PyMuPDF
import nltk
from nltk.tokenize import sent_tokenize
import chromadb
import hashlib
import requests
import io
# ================= RETRIEVAL LIBS =================
# Moved inside functions to avoid slow startup
# from rank_bm25 import BM25Okapi
# from sentence_transformers import SentenceTransformer, CrossEncoder
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import google.api_core.exceptions
import google.generativeai as genai
import time

# Download NLTK data if not present
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download("punkt", quiet=True)

# -----------------------------
# Configuration
# -----------------------------

# Google Drive configuration
GDRIVE_LINK = None  # Deprecated: Use function parameters instead

EMBEDDING_MODEL_NAME = "models/embedding-001"
COLLECTION_NAME = "student_notes_local" # Force local collection name

# Force local settings
USE_LOCAL_EMBEDDINGS = True
LOCAL_MODEL_NAME = "all-MiniLM-L6-v2" # Example local model
ENABLE_RERANKER = False
CROSS_ENCODER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

CROSS_ENCODER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
TOP_N = 3
OVERLAP_WORDS = 100
# Helper function for BM25 (if needed)
# -----------------------------
def get_bm25_scores(query, doc_list):
    from rank_bm25 import BM25Okapi
    import string
    
    def tokenize(text):
        # fast simple tokenization: remove punctuation and lower case
        text = text.lower().translate(str.maketrans('', '', string.punctuation))
        return text.split()

    tokenized_corpus = [tokenize(doc) for doc in doc_list]
    bm25 = BM25Okapi(tokenized_corpus)
    tokenized_query = tokenize(query)
    doc_scores = bm25.get_scores(tokenized_query)
    return doc_scores

# -----------------------------
# 1. Generate PDF hash (unique identity)
# -----------------------------
def get_pdf_hash(pdf_path):
    hasher = hashlib.sha256()
    with open(pdf_path, "rb") as f:
        hasher.update(f.read())
    return hasher.hexdigest()


# -----------------------------
# 1b. Generate PDF hash from bytes (for Google Drive PDFs)
# -----------------------------
def get_pdf_hash_from_bytes(pdf_bytes):
    """Generate SHA256 hash from PDF bytes for deduplication."""
    hasher = hashlib.sha256()
    hasher.update(pdf_bytes)
    return hasher.hexdigest()


# -----------------------------
# 1c. Convert Google Drive link to direct download URL
# -----------------------------
def convert_gdrive_link_to_direct(gdrive_url):
    """
    Extracts file ID from Google Drive URL.
    
    Handles formats:
    - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    - https://drive.google.com/open?id=FILE_ID
    
    Returns: FILE_ID
    """
    if "id=" in gdrive_url:
        return gdrive_url.split("id=")[1].split("&")[0]
    elif "/d/" in gdrive_url:
        return gdrive_url.split("/d/")[1].split("/")[0]
    else:
        raise ValueError(f"Could not extract file ID from Google Drive URL: {gdrive_url}")


# -----------------------------
# 1d. Download PDF from Google Drive to memory
# -----------------------------
def download_pdf_from_gdrive(gdrive_url):
    """
    Downloads PDF from Google Drive URL to memory (bytes).
    Uses session to handle confirmation tokens for large files.
    
    Args:
        gdrive_url: Google Drive shareable link
        
    Returns:
        bytes: PDF content in memory
        
    Raises:
        Exception: If download fails or content is not a PDF
    """
    file_id = convert_gdrive_link_to_direct(gdrive_url)
    
    print(f"Downloading PDF from Google Drive (File ID: {file_id[:20]}...)...")
    
    try:
        session = requests.Session()
        url = "https://drive.google.com/uc?export=download"
        response = session.get(url, params={"id": file_id}, stream=True)
        
        # Check for confirmation token (for large files)
        for key, value in response.cookies.items():
            if key.startswith("download_warning"):
                response = session.get(url, params={"id": file_id, "confirm": value}, stream=True)
                break
        
        response.raise_for_status()
        pdf_bytes = response.content
        
        # Check if content is PDF
        if not pdf_bytes.startswith(b'%PDF'):
            raise ValueError(f"Downloaded content is not a PDF. First bytes: {pdf_bytes[:50]}")
        
        print(f"Successfully downloaded PDF ({len(pdf_bytes)} bytes)")
        return pdf_bytes
        
    except requests.exceptions.RequestException as e:
        raise Exception(f"Failed to download PDF from Google Drive: {e}")


# -----------------------------
# 2. Extract text from PDF
# -----------------------------
def extract_pdf_text(pdf_path):
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"File not found: {pdf_path}")

    doc = fitz.open(pdf_path)
    text_pages = []

    for page in doc:
        text = page.get_text()
        if text.strip():
            text_pages.append(text)

    return "\n".join(text_pages)


# -----------------------------
# 2b. Extract text from PDF bytes (for Google Drive PDFs)
# -----------------------------
def extract_pdf_text_from_bytes(pdf_bytes):
    """
    Extracts text from PDF bytes in memory using PyPDF2.
    
    Args:
        pdf_bytes: PDF content as bytes
        
    Returns:
        str: Extracted text from all pages
    """
    try:
        from PyPDF2 import PdfReader
        from io import BytesIO
        
        reader = PdfReader(BytesIO(pdf_bytes))
        text = ""
        
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        
        return text
    except ImportError:
        # Fallback to PyMuPDF if PyPDF2 is not available
        print("Warning: PyPDF2 not found, falling back to PyMuPDF")
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text_pages = []

        for page in doc:
            text = page.get_text()
            if text.strip():
                text_pages.append(text)
        
        doc.close()
        return "\n".join(text_pages)


# -----------------------------
# 3. Clean text
# -----------------------------
def clean_text(text):
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# -----------------------------
# 4. Chunk text (sentence-aware + overlap)
# -----------------------------
def chunk_text(text, max_words=300, overlap_words=50):
    sentences = sent_tokenize(text)
    chunks = []

    current_chunk = []
    current_length = 0

    for sentence in sentences:
        sentence_len = len(sentence.split())

        if current_length + sentence_len <= max_words:
            current_chunk.append(sentence)
            current_length += sentence_len
        else:
            chunks.append(" ".join(current_chunk))

            overlap = " ".join(current_chunk).split()[-overlap_words:]
            current_chunk = [" ".join(overlap), sentence]
            current_length = len(overlap) + sentence_len

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


# -----------------------------
# 5. Generate embeddings (LangChain + Google Gemini or Local)
# -----------------------------
def get_embedding_model():
    print("Using LOCAL embeddings (SentenceTransformer)")
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(LOCAL_MODEL_NAME)

def generate_embeddings(chunks, model):
    try:
        # SentenceTransformer.encode takes a list of strings
        embeddings = model.encode(chunks, convert_to_numpy=True).tolist()
        return embeddings
    except Exception as e:
        print(f"Error generating local embeddings: {e}")
        return None


# -----------------------------
# 6. Store embeddings in ChromaDB (idempotent)
# -----------------------------
def store_in_chromadb(pdf_source, chunks, embeddings, pdf_hash=None, is_gdrive=False):
    """
    Stores PDF chunks and embeddings in ChromaDB.
    
    Args:
        pdf_source: File path (local) or URL (Google Drive)
        chunks: List of text chunks
        embeddings: List of embedding vectors
        pdf_hash: Pre-computed hash (optional, will compute if not provided)
        is_gdrive: True if source is Google Drive URL, False if local file
    """
    if embeddings is None:
        return None

    # Get PDF hash
    if pdf_hash is None:
        if is_gdrive:
            raise ValueError("pdf_hash must be provided for Google Drive PDFs")
        else:
            pdf_hash = get_pdf_hash(pdf_source)
    
    pdf_id = pdf_hash
    import uuid # Moved import inside function

    client = chromadb.PersistentClient(path="./chroma_store")
    
    # Enforce cosine distance for meaningful 0-1 similarity scores
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"} 
    )

    # ---- CHECK IF PDF ALREADY EXISTS ----
    existing = collection.get(
        where={"pdf_id": pdf_id},
        limit=1
    )

    if existing["ids"]:
        print("PDF already ingested. Skipping insertion.")
        return collection

    # ---- INSERT NEW PDF CHUNKS ----
    ids = [str(uuid.uuid4()) for _ in chunks]

    # Determine source name for metadata
    if is_gdrive:
        source_name = f"GoogleDrive: {pdf_source[:50]}..." if len(pdf_source) > 50 else f"GoogleDrive: {pdf_source}"
    else:
        source_name = os.path.basename(pdf_source)
    
    metadatas = [
        {
            "pdf_id": pdf_id,
            "source": source_name,
            "chunk_index": i,
            "is_gdrive": is_gdrive
        }
        for i in range(len(chunks))
    ]

    collection.add(
        documents=chunks,
        embeddings=embeddings, # List of lists (floats)
        metadatas=metadatas,
        ids=ids
    )

    print("New PDF ingested successfully.")
    return collection


# -----------------------------
# 7. Query ChromaDB (Hybrid + Reranking)
# -----------------------------
def query_chromadb(collection, question, model, top_n=TOP_N, where=None):
    # 1. Semantic Retrieval (fetch more candidates for reranking)
    candidate_limit = top_n * 4
    # model is SentenceTransformer
    # encode returns numpy array, we need list for chromadb
    query_embedding = model.encode([question]).tolist()[0]

    semantic_results = collection.query(
        query_embeddings=[query_embedding], 
        n_results=candidate_limit,
        where=where
    )
    
    # Extract candidates
    if not semantic_results["documents"]:
        return []
        
    candidates = semantic_results["documents"][0]
    semantic_distances = semantic_results["distances"][0]
    semantic_ids = semantic_results["ids"][0]
    
    # 2. BM25 Scoring (Keyword matching)
    all_data = collection.get()
    corpus = all_data["documents"]
    
    doc_to_bm25 = {doc: 0.0 for doc in candidates}
    if corpus and len(corpus) > 0:
        try:
            bm25_all_scores = get_bm25_scores(question, corpus)
            # Create a mapping of doc content to BM25 score for our candidates
            doc_to_bm25 = {doc: score for doc, score in zip(corpus, bm25_all_scores)}
        except Exception as e:
            print(f"⚠️ BM25 failed: {e}. Falling back to semantic only.")
    else:
        print("ℹ️ Corpus is empty. Skipping BM25.")

    # 3. Combine scores (Semantic Similarity + Normalized BM25)
    hybrid_results = []
    max_bm25 = max(doc_to_bm25.values()) if doc_to_bm25.values() and max(doc_to_bm25.values()) > 0 else 0.0
    
    for i, doc in enumerate(candidates):
        sem_sim = 1 - semantic_distances[i]
        bm25_score = doc_to_bm25.get(doc, 0.0)
        
        # Normalize BM25 safely
        norm_bm25 = (bm25_score / max_bm25) if max_bm25 > 0 else 0.0
        
        # Combined score (weighted)
        combined_score = (sem_sim * 0.7) + (norm_bm25 * 0.3)
        
        hybrid_results.append({
            "document": doc,
            "id": semantic_ids[i],
            "sem_sim": sem_sim,
            "bm25_score": bm25_score,
            "hybrid_score": combined_score
        })

    # Sort by hybrid score
    hybrid_results.sort(key=lambda x: x["hybrid_score"], reverse=True)

    # 4. Optional Cross-Encoder Reranking
    if ENABLE_RERANKER:
        try:
            print(f"🔄 Reranking with {CROSS_ENCODER_MODEL}...")
            from sentence_transformers import CrossEncoder
            reranker = CrossEncoder(CROSS_ENCODER_MODEL)
            pairs = [[question, res["document"]] for res in hybrid_results]
            rerank_scores = reranker.predict(pairs)
            
            for i, score in enumerate(rerank_scores):
                hybrid_results[i]["rerank_score"] = float(score)
            
            # Sort by rerank score
            hybrid_results.sort(key=lambda x: x.get("rerank_score", -100), reverse=True)
        except Exception as e:
            print(f"⚠️ Reranker failed: {e}. Using hybrid scores.")

    return hybrid_results[:top_n]


# -----------------------------
def ingest_local_documents(pdf_path=None, gdrive_url=None):
    """
    Ingests PDF files into ChromaDB from local files or Google Drive.
    
    Args:
        pdf_path (str, optional): Specific PDF file path to ingest. 
                                  If None, scans current directory for all PDFs.
        gdrive_url (str, optional): Google Drive shareable link to PDF.
                                    If provided, downloads and ingests from Google Drive.
    """
    print("\n--- INGESTION STARTED ---")
    embedding_model = get_embedding_model()
    
    # Handle Google Drive URL
    if gdrive_url:
        print(f"Ingesting from Google Drive: {gdrive_url}")
        try:
            # Download PDF to memory
            pdf_bytes = download_pdf_from_gdrive(gdrive_url)
            
            # Extract text from bytes
            raw_text = extract_pdf_text_from_bytes(pdf_bytes)
            
            # Generate hash from bytes
            pdf_hash = get_pdf_hash_from_bytes(pdf_bytes)
            
            # Clean and chunk
            cleaned = clean_text(raw_text)
            chunks = chunk_text(cleaned)
            
            # Generate embeddings and store
            embeddings = generate_embeddings(chunks, embedding_model)
            if embeddings:
                store_in_chromadb(
                    pdf_source=gdrive_url,
                    chunks=chunks,
                    embeddings=embeddings,
                    pdf_hash=pdf_hash,
                    is_gdrive=True
                )
                print("Google Drive PDF ingested successfully.")
            else:
                print("Failed to generate embeddings for Google Drive PDF.")
        except Exception as e:
            print(f"Failed to ingest Google Drive PDF: {e}")
        return
    
    # Handle local files (existing logic)
    # If specific path provided, use only that file
    if pdf_path:
        if not os.path.exists(pdf_path):
            print(f"Error: File '{pdf_path}' not found.")
            return
        pdf_files = [pdf_path]
        print(f"Ingesting specific file: {pdf_path}")
    else:
        # List all PDFs in current directory
        pdf_files = [f for f in os.listdir('.') if f.lower().endswith('.pdf')]
        print("Scanning current directory for PDF files...")
    
    if not pdf_files:
        print("No PDF files found.")
        return
    
    total_new = 0
    for pdf_file in pdf_files:
        print(f"Checking document: {pdf_file}...")
        try:
            # Hash to check for changes/duplicates
            raw_text = extract_pdf_text(pdf_file)
            cleaned = clean_text(raw_text)
            chunks = chunk_text(cleaned)
            
            # generate_embeddings and store_in_chromadb handle the rest
            embeddings = generate_embeddings(chunks, embedding_model)
            if embeddings:
                store_in_chromadb(pdf_file, chunks, embeddings)
                total_new += 1
        except Exception as e:
            print(f"Failed to ingest {pdf_file}: {e}")
            
    print(f"Ingestion complete. Processed {total_new} documents.")

# 8. MAIN PIPELINE
# -----------------------------
if __name__ == "__main__":
    print("\n--- PIPELINE STARTED ---")

    # Initialize Model
    embedding_model = get_embedding_model()

    # Check if Google Drive link is configured
    if GDRIVE_LINK:
        print("Using Google Drive PDF source")
        try:
            # Download PDF from Google Drive to memory
            pdf_bytes = download_pdf_from_gdrive(GDRIVE_LINK)
            
            # Extract text from bytes
            raw_text = extract_pdf_text_from_bytes(pdf_bytes)
            
            # Generate hash
            pdf_hash = get_pdf_hash_from_bytes(pdf_bytes)
            pdf_source = GDRIVE_LINK
            is_gdrive = True
        except Exception as e:
            print(f"Error processing Google Drive PDF: {e}")
            exit(1)
    else:
        # Use local PDF (existing behavior)
        pdf_path = "Sample SRS.pdf"
        print(f"Using local PDF: {pdf_path}")
        
        try:
            raw_text = extract_pdf_text(pdf_path)
            pdf_hash = get_pdf_hash(pdf_path)
            pdf_source = pdf_path
            is_gdrive = False
        except FileNotFoundError:
            print(f"Error: File '{pdf_path}' not found. Please add the PDF to the directory or set GDRIVE_LINK.")
            exit(1)

    # Debug: Print first line of extracted text to verify PDF reading
    first_line = raw_text.split('\n')[0] if raw_text else "(empty)"
    print(f"\n[DEBUG] First line of extracted PDF text: {first_line[:200]}...\n")

    # Clean
    cleaned_text = clean_text(raw_text)

    # Chunk
    chunks = chunk_text(cleaned_text)
    print(f"Total chunks created: {len(chunks)}")

    # Embeddings
    print("Generating embeddings...")
    embeddings = generate_embeddings(chunks, embedding_model)
    
    if embeddings is None:
        print("Stopping pipeline due to embedding failure.")
        exit(1)

    # Store in ChromaDB (safe ingestion)
    collection = store_in_chromadb(
        pdf_source=pdf_source,
        chunks=chunks,
        embeddings=embeddings,
        pdf_hash=pdf_hash,
        is_gdrive=is_gdrive
    )
    if collection is None:
         print("Stopping pipeline due to storage failure.")
         exit(1)
         
    print(f"Total chunks in DB: {collection.count()}")

    # Interactive Query Loop
    while True:
        user_query = input("\nAsk a question (or 'exit' to quit): ")
        if user_query.lower() in ['exit', 'quit']:
            break
        
        results = query_chromadb(collection, user_query, embedding_model, top_n=3)
        
        if results:
            print("\n--- Top 3 Matching Chunks ---")
            for i, result in enumerate(results):
                print(f"Result {i+1} (Hybrid Score: {result['hybrid_score']:.4f}):")
                print(result['document'])
                print("-" * 30)