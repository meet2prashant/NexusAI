import os
import json
import time
import google.generativeai as genai
import services.rag as rag

def summarize_and_translate_document_stream(file_path: str, doc_type: str, category: str, target_language: str, summary_style: str = "Professional", summary_length: str = "Medium"):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        yield f"data: {json.dumps({'error': 'GEMINI_API_KEY is not set or missing in environment variables.'})}\n\n"
        return
        
    genai.configure(api_key=api_key)
    file_name = os.path.basename(file_path)
    
    # Extract using the improved local OCR pipeline first to handle scanned Admit Cards!
    try:
        chunks = rag.extract_and_chunk_file(file_path, file_name)
    except Exception as e:
        yield f"data: {json.dumps({'error': f'Failed to extract document natively: {str(e)}'})}\n\n"
        return

    full_text = " ".join(chunks)

    # Check for complex documents that we send directly to Gemini via its raw File API (for Cloud OCR & Transcription)
    ext = os.path.splitext(file_path)[1].lower()
    gemini_file = None
    if ext in [".mp3", ".wav", ".m4a", ".mp4", ".mov", ".pdf", ".png", ".jpg", ".jpeg"]:
        try:
            gemini_file = genai.upload_file(file_path)
            # Wait for processing on Google's end
            while gemini_file.state.name == 'PROCESSING':
                time.sleep(2)
                gemini_file = genai.get_file(gemini_file.name)
            if gemini_file.state.name == 'FAILED':
                yield f"data: {json.dumps({'error': 'Gemini API failed to process complex document.'})}\n\n"
                return
        except Exception as e:
             yield f"data: {json.dumps({'error': f'Failed to upload to Gemini API: {str(e)}'})}\n\n"
             return

    # ONLY block the process if we don't have a Google Document and the local text is totally blank
    if not gemini_file and len(full_text.strip()) < 10:
        yield f"data: {json.dumps({'error': 'No text could be extracted from this document and Cloud uploading failed.'})}\n\n"
        return

    # Index text locally to RAG for the Chatbot Context
    try:
        if ext not in [".mp3", ".wav", ".m4a", ".mp4", ".mov"]:
            rag.index_document(file_path, file_name)
    except Exception as e:
        print(f"RAG Index Error: {e}")

    try:
        config = genai.GenerationConfig(temperature=0.3)
        model = genai.GenerativeModel("gemini-2.5-flash-lite", generation_config=config)
        
        system_instruction = f"""
You are an expert document analyzer evaluating a '{doc_type}' tagged as '{category}'.
Target Summary Length: {summary_length}.
Tone: {summary_style}

CRITICAL: You MUST output your response EXACTLY in the following format. Do not deviate!

__KEYWORDS__
Keyword1|Keyword2|Keyword3|Keyword4
__SUMMARY__
**Intelligent {summary_style} Summary:**

[Your beautifully formatted Markdown summary here. If the text is purely an Admit Card or Form, gracefully list its extracted details instead of hallucinating stories]
__TRANSLATION__
{"N/A" if target_language.lower() == "english" else f"WRITE THE FULL SUMMARY TRANSLATED INTO {target_language.upper()} HERE. DO NOT WRITE IN ENGLISH."}
__PREDICTIONS__
Evaluate the intrinsic reliability, bias, and authority of the textual source and generate a realistic safety integer from 0 to 100 predicting its factual accuracy. On the very next line, output exactly:
__TRUST_SCORE__|[0-100]
Finally, end your response by creating EXACTLY 3 highly intelligent follow-up questions the user should ask you next about this document. Format strictly as:
||| Question 1 ||| Question 2 ||| Question 3
"""
        
        prompt = system_instruction + f"\n\nPlease analyze the document context thoroughly."

        content_parts = []
        if gemini_file:
            content_parts.append(gemini_file)
        else:
             content_parts.append(f"Document Text Content:\n{full_text}")
             
        content_parts.append(prompt)

        # Let the UI know we are officially using Gemini again, or fallback to the local RAG pointer
        yield f"data: {json.dumps({'gemini_file_name': gemini_file.name if gemini_file else file_name, 'original_text_length': len(full_text)})}\n\n"
        
        # Stream the Gemini response chunks heavily and correctly
        response = model.generate_content(content_parts, stream=True)
        
        for chunk in response:
            try:
                if chunk.text:
                     yield f"data: {json.dumps({'chunk': chunk.text})}\n\n"
            except ValueError:
                 pass # Ignore metadata/usage-only chunks at the end of the stream without throwing an exception

    except Exception as e:
        yield f"data: {json.dumps({'error': f'Gemini streaming failed: {str(e)}'})}\n\n"


def chat_with_document_stream(file_name: str, message: str, history: list = None):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        yield f"data: {json.dumps({'error': 'GEMINI_API_KEY is not set.'})}\n\n"
        return
        
    genai.configure(api_key=api_key)
    
    rag_context = ""
    gemini_file = None
    
    if file_name.startswith("files/"):
        try:
            gemini_file = genai.get_file(file_name)
        except Exception as e:
            print(f"Gemini File Error: {e}")
    else:
        try:
            rag_context = rag.retrieve_context(file_name, message, top_k=5)
        except Exception as e:
            print(f"RAG Error: {e}")

    try:
        model = genai.GenerativeModel("gemini-2.5-flash-lite")
        
        system_prompt = "You are a highly knowledgeable analytical assistant. First and foremost, answer the user's question accurately based on the document or image provided. However, if the document lacks specific details to fully answer the question, you MUST use your general world knowledge to provide a complete answer. If the user's question is completely unrelated to the document, you should still answer it briefly using general knowledge, but try to steer them back.\n\nCRITICAL RULE: You must always deeply analyze your answer and append EXACTLY 3 highly intelligent suggested follow-up questions at the very end of your response, strictly formatted as: ||| First Question? ||| Second Question? ||| Third Question?"
        
        messages = [
            {'role': 'user', 'parts': [system_prompt]},
            {'role': 'model', 'parts': ["Understood. Let's proceed."]}
        ]
        
        if history:
            for msg in history:
                role = "user" if msg["role"] == "user" else "model"
                messages.append({'role': role, 'parts': [msg["content"]]})
                
        # Inject the physical file OR the local exact RAG text
        final_parts = []
        if gemini_file:
            final_parts.append(gemini_file)
            final_parts.append(f"New User Question:\n{message}")
        else:
            final_prompt = f"Retrieved Document Context:\n{rag_context}\n\nNew User Question:\n{message}"
            final_parts.append(final_prompt)
            
        messages.append({'role': 'user', 'parts': final_parts})
        
        response = model.generate_content(messages, stream=True)
        
        for chunk in response:
            try:
                if chunk.text:
                    yield f"data: {json.dumps({'chunk': chunk.text})}\n\n"
            except ValueError:
                pass # Ignore metadata/usage-only chunks at the end of the stream
                
    except Exception as e:
         yield f"data: {json.dumps({'error': f'Gemini Chat failed: {str(e)}'})}\n\n"
