import os
import pymupdf
import docx
import numpy as np
import google.generativeai as genai
from typing import List
import pickle

# On Render, isolated threads can't share plain variables. 
# We serialize the Vector vectors to the local disk!
RAG_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "rag_db.pkl")

def get_rag_store():
    if os.path.exists(RAG_FILE):
        try:
            with open(RAG_FILE, "rb") as f:
                return pickle.load(f)
        except Exception:
            return {}
    return {}

def save_rag_store(store):
    os.makedirs(os.path.dirname(RAG_FILE), exist_ok=True)
    with open(RAG_FILE, "wb") as f:
        pickle.dump(store, f)

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
    """Splits a long text into distinct word chunks."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), max(1, chunk_size - overlap)):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks

def extract_and_chunk_file(file_path: str, file_name: str) -> List[str]:
    """Reads the raw file directly and splits it into text chunks."""
    ext = os.path.splitext(file_path)[1].lower()
    text = ""
    
    if ext == ".pdf":
        doc = pymupdf.open(file_path)
        for page in doc:
            page_text = page.get_text()
            if page_text.strip():
                text += page_text + "\n"
        doc.close()
    elif ext == ".docx":
        doc = docx.Document(file_path)
        text = "\n".join([para.text for para in doc.paragraphs])
    elif ext == ".txt":
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        text = f"Unsupported or pure-image binary file: {file_name}. Handled exclusively by Gemini Multimodal API."
            
    return chunk_text(text)

def generate_embeddings(texts: List[str]) -> np.ndarray:
    """Uses Gemini text-embedding model to instantly generate 768-dimensional vectors in the cloud."""
    if not texts:
        return np.array([])
        
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
        
    response = genai.embed_content(
        model="models/gemini-embedding-001",
        content=texts,
        task_type="retrieval_document"
    )
    return np.array(response["embedding"])

def index_document(file_path: str, file_name: str):
    """Chunks the doc, generates embeddings, and saves to the in-memory array."""
    chunks = extract_and_chunk_file(file_path, file_name)
    
    if not chunks:
        return
        
    embeddings = generate_embeddings(chunks)
    
    store = get_rag_store()
    store[file_name] = {
        "chunks": chunks,
        "embeddings": embeddings
    }
    save_rag_store(store)

def retrieve_context(file_name: str, query: str, top_k: int = 3) -> str:
    """
    Given a user query, embeds the query via Gemini API and mathematically finds the best matching chunks.
    """
    store = get_rag_store()
    
    if file_name not in store or len(store[file_name]["chunks"]) == 0:
        return "No local context found in RAG store. Proceeding with pure Gemini."
        
    doc_data = store[file_name]
    
    # 1. Embed query 
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
        
    query_response = genai.embed_content(
        model="models/gemini-embedding-001",
        content=query,
        task_type="retrieval_query"
    )
    query_vec = np.array(query_response["embedding"])
    
    # Cosine similarity
    query_norm = np.linalg.norm(query_vec)
    if query_norm == 0: return ""
    query_vec = query_vec / query_norm
    
    doc_matrix = np.array(doc_data["embeddings"])
    if doc_matrix.ndim == 1:
        doc_matrix = doc_matrix.reshape(1, -1)
        
    doc_norms = np.linalg.norm(doc_matrix, axis=1, keepdims=True)
    doc_matrix_norm = doc_matrix / (doc_norms + 1e-10)
    
    similarities = np.dot(doc_matrix_norm, query_vec)
    
    # Top K indices
    top_indices = np.argsort(similarities)[::-1][:top_k]
    
    retrieved_chunks = [doc_data["chunks"][idx] for idx in top_indices]
    context = "\n\n--- RAG RETRIEVED TEXT STATEMENTS ---\n\n".join(retrieved_chunks)
    return context
