import tempfile
import os
import docx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from services.ai import summarize_and_translate_document_stream, chat_with_document_stream
from dotenv import load_dotenv

import uuid
import json
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import services.stats as stats_service
import services.scraper as scraper_service
from fastapi.responses import StreamingResponse

SHARE_DIR = os.path.join(os.path.dirname(__file__), "data", "shares")
os.makedirs(SHARE_DIR, exist_ok=True)

class ChatRequest(BaseModel):
    gemini_file_name: str
    message: str
    history: Optional[List[Dict[str, Any]]] = None


load_dotenv(override=True)

app = FastAPI(title="NexusAI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.post("/api/summarize")
async def summarize_document(
    file: UploadFile = File(...),
    doc_type: str = Form("General"),
    category: str = Form("General"),
    target_language: str = Form("English"),
    summary_style: str = Form("Professional"),
    summary_length: str = Form("Medium")
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".txt", ".docx", ".png", ".jpg", ".jpeg", ".mp3", ".wav", ".m4a"]:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, TXT, Image, and Audio files are supported")
    
    try:
        content = await file.read()
        
        # Convert DOCX to TXT for Gemini compatibility
        if ext == ".docx":
            import io
            doc = docx.Document(io.BytesIO(content))
            full_text = [para.text for para in doc.paragraphs]
            content = "\n".join(full_text).encode('utf-8')
            ext = ".txt"
            
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
            
        # Log analytics locally
        stats_service.increment_document(target_language)
            
        def stream_generator():
            try:
                for chunk in summarize_and_translate_document_stream(
                    file_path=tmp_path,
                    doc_type=doc_type,
                    category=category,
                    target_language=target_language,
                    summary_style=summary_style,
                    summary_length=summary_length
                ):
                    yield chunk
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

        return StreamingResponse(stream_generator(), media_type="text/event-stream")
        
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=500, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

class ShareRequest(BaseModel):
    summary: str
    translation: str
    language: str
    gemini_file_name: str
    original_text_length: Optional[int] = None
    keywords: Optional[List[str]] = None

@app.post("/api/share")
def create_share_link(request: ShareRequest):
    share_id = str(uuid.uuid4())
    file_path = os.path.join(SHARE_DIR, f"{share_id}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(request.model_dump(), f)
    return {"success": True, "share_id": share_id}

@app.get("/api/share/{share_id}")
def get_share_link(share_id: str):
    file_path = os.path.join(SHARE_DIR, f"{share_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Shared summary not found")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data

@app.get("/api/stats")
def get_analytics():
    return stats_service.get_stats()
@app.post("/api/summarize_url")
async def summarize_url(
    url: str = Form(...),
    doc_type: str = Form("General"),
    category: str = Form("General"),
    target_language: str = Form("English"),
    summary_style: str = Form("Professional"),
    summary_length: str = Form("Medium")
):
    try:
        # Scrape internet content
        content = scraper_service.scrape_url_to_text(url)
        
        # Save securely as temporary text file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as tmp:
            tmp.write(content.encode('utf-8'))
            tmp_path = tmp.name
            
        stats_service.increment_document(target_language)
            
        def stream_generator():
            try:
                for chunk in summarize_and_translate_document_stream(
                    file_path=tmp_path,
                    doc_type=doc_type,
                    category=category,
                    target_language=target_language,
                    summary_style=summary_style,
                    summary_length=summary_length
                ):
                    yield chunk
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

        return StreamingResponse(stream_generator(), media_type="text/event-stream")
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/api/chat")
async def chat_document(request: ChatRequest):
    # Log analytics locally
    stats_service.increment_chat()
    
    return StreamingResponse(
        chat_with_document_stream(
            file_name=request.gemini_file_name,
            message=request.message,
            history=request.history
        ),
        media_type="text/event-stream"
    )

frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
