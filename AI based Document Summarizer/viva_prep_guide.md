# NexusAI: Capstone Viva Preparation Guide

This guide contains everything you need to know to ace your final capstone viva for the **NexusAI** (formerly Document Summarizer) project. Review this document carefully to articulate the architectural decisions, technologies, and AI capabilities of your project.

## 1. Elevator Pitch (What is NexusAI?)
**NexusAI** is an advanced, multimodal document analysis and summarization platform. It allows users to upload various file formats (documents, images, audio) or web URLs, and leverages Google's Gemini LLMs to extract insights, generate summaries, evaluate factual reliability, and allow interactive real-time Q&A against the document context. It is designed to be an enterprise-grade SaaS application with a highly responsive, modern UI.

---

## 2. System Architecture & Tech Stack
If asked "How is your application structured?" or "Why didn't you use React/Node.js?":

**Architecture:** We used a **Client-Server Architecture**. It strictly separates the presentation layer (Frontend) from the heavy processing and AI orchestration layer (Backend).

### Frontend (Client-Side)
*   **Vanilla Web Tech (HTML5, CSS3, ES6+ JS):** We intentionally avoided heavy frameworks like React. We used raw JavaScript to handle logic, Event Streams (`EventSource`), and DOM manipulation to ensure the client is ultra-fast and lightweight.
*   **CSS3 Advanced Concepts:** Utilized CSS Grid, Flexbox, Custom CSS Variables, and dynamic theming (4 themes: Midnight, Daylight, Cyberpunk, Forest).
*   **Key Libraries:** 
    *   `marked.min.js`: Parses Markdown from Gemini into HTML in real-time.
    *   `html2pdf.bundle.js`: For exporting results to PDF client-side.
    *   `Chart.js`: Powers the Global Admin Dashboard visualizations.
    *   `qrcode.min.js`: Generates QR codes for mobile handover.
*   **Browser APIs:** Used the native **Web Speech API** for both Text-to-Speech (reading summaries) and SpeechRecognition (voice chat input).

### Backend (Server-Side)
*   **Python 3.10+ & FastAPI:** We chose FastAPI because it is an asynchronous framework built on Starlette, making it extremely fast and highly performant for streaming LLM responses. Served via **Uvicorn** (ASGI server).
*   **Extraction Libraries:**
    *   `PyMuPDF` & `python-docx`: Used for robust local text extraction and OCR from PDF and DOCX files.
    *   `BeautifulSoup4` & `Requests`: Powers the `scraper.py` module to extract clean text from any given URL.

---

## 3. The Brains: AI Models & RAG
If asked "How does the AI actually work?" or "How do you prevent the AI from hallucinating?":

### Core LLM Models
*   **Google Gemini 2.5 Flash Lite:** The core brain of the system. Chosen because it is highly efficient, natively multimodal (understands text, images, and audio), and extremely fast.
*   **Gemini File API:** For heavy multi-modal formats (like `.mp3` audio or large images), we upload the file directly to Google's cloud-native extraction APIs to bypass heavy local processing.

### Retrieval-Augmented Generation (RAG) System
This is crucial. You built a custom RAG engine.
1.  **Embedding Model:** We use **Gemini Embedding 001** (`models/gemini-embedding-001`) to mathematically encode document text chunks into 768-dimensional dense vectors.
2.  **Vector Database:** Instead of a bloated external database, we built a highly efficient **Pickle-based Local Vector Database** (`rag_db.pkl`).
3.  **How it prevents hallucinations:** When a user asks a question in the chat panel, their query is embedded into a vector. We calculate the **Cosine Similarity** via Numpy arrays to fetch the closest semantic chunks from the document. We feed those specific chunks to Gemini as ground-truth context, forcing it to answer *only* based on the document.

---

## 4. Core Enterprise Features
Highlight these if asked "What makes your project unique?" or "What are your key features?":

1.  **Real-time Streaming Engine (SSE):** Uses Server-Sent Events to stream LLM tokens directly to the UI, creating a fluid "typing" effect rather than making the user wait 30 seconds for a full load.
2.  **Responsible AI (RAI) Trust & Bias Scoring:** A bespoke algorithm that forces the AI to objectively evaluate the source's intrinsic reliability, bias, and authority, computing a deterministic "Trust Score" (0-100).
3.  **Global Admin Analytics Dashboard:** Logs processed documents and chats securely in `stats.json` and displays live metrics cleanly utilizing `Chart.js`.
4.  **QR-Code Mobile Handover:** Summaries generate ephemeral share IDs injected into a QR code, allowing users to scan on their phone and resume reading on mobile.
5.  **Multi-Language Translation:** Built-in engine to instantly translate summaries into English, Hindi, or Sanskrit.
6.  **Auto-generated Smart Prompts:** The AI evaluates its own responses and suggests 3 intelligent follow-up questions for the user (chip buttons).

---

## 5. Anticipated Viva Questions & How to Answer Them

> **Q: Why did you choose Python for the backend instead of Node.js?**
> *Answer:* Python is the industry standard for AI and data processing. It allowed us to easily integrate the Google Generative AI SDK, utilize powerful text extraction libraries like PyMuPDF, and perform complex math for our RAG system using Numpy. FastAPI gave us the asynchronous speed we needed, comparable to Node.js.

> **Q: How does your web scraper work?**
> *Answer:* The user inputs a URL. Our `scraper.py` module uses the `Requests` library to fetch the raw HTML. Then, it uses `BeautifulSoup4` to parse the DOM, stripping away ads, navigation, and scripts, leaving only the clean article text which is then passed to Gemini for summarization.

> **Q: What is SSE and why use it over WebSockets?**
> *Answer:* SSE stands for Server-Sent Events. It's a unidirectional protocol where the server pushes data to the client. Since the AI generates tokens sequentially and we only need to stream text *to* the user (not constantly back and forth like a multiplayer game), SSE was much more lightweight and easier to implement over standard HTTP than full WebSockets.

> **Q: What challenges did you face?**
> *Answer:* (You can mention this real issue) One major challenge was ensuring the Chatbot context synced with the uploaded document. We had to ensure the backend correctly passed the `gemini_file_name` back to the frontend, so the subsequent SSE chat requests knew exactly which document or RAG index to query against without losing the state.

> **Q: Is your application secure or production ready?**
> *Answer:* Currently, it's a robust prototype. We implemented basic tracking in a local `stats.json`. However, our architecture is designed to scale. For production, we would replace the local JSON with an SQL database (SQLAlchemy) and implement JWT authentication, which are already staged in our technical roadmap.
