# NexusAI - Complete Technical Schema & Architecture

This document outlines every technology, library, framework, and custom module used in the **NexusAI** (formerly Document Summarizer) project. Your team can use this as a foundational reference to write the "Implementation", "System Architecture", and "Technologies Used" chapters of your research paper or thesis.

---

## 1. System Overview Architecture

NexusAI uses a **Client-Server Architecture** separating the presentation layer (Vanilla Web Frontend) from the processing layer (Python FastAPI Backend).

*   **Frontend (Static Web Application)**: Pure HTML, CSS, and JS. Lightweight, reliant on browser APIs for things like TTS and file handling.
*   **Backend (REST & Server-Sent Events - SSE)**: A Python FastAPI server that handles complex document ingestion, talks directly to the Large Language Model (Google Gemini), handles chunking, and returns streams of data to the frontend for real-time typing effects.

---

## 2. Technology Stack Breakdown

### Frontend (Client-Side)
*   **HTML5/CSS3**: Structured with semantic tags. Uses advanced CSS3 concepts like CSS Grid, Flexbox, CSS Variables (Custom Properties), and Keyframe animations.
*   **Vanilla JavaScript (ES6+)**: Handles all logic, Event Streams (`EventSource`), asynchronous fetching, and DOM manipulation without a heavy framework like React.
*   **marked.min.js**: A Markdown parser used to convert the raw markdown text coming out of Gemini into beautifully formatted HTML in real-time.
*   **html2pdf.bundle.min.js**: Client-side library used to export the generated summaries and translations straight to PDF.
*   **Chart.js**: powers the **Global Admin Dashboard** to render the interactive graphical Data visualizations (e.g., Doughnut charts of languages used).
*   **qrcode.min.js**: powers the **QR-Code Engine**, instantly translating the currently generated summary state into a scannable 2D barcode for mobile continuity.
*   **Web Speech API**: A native browser API used to implement the **Text-to-Speech (TTS)** "Listen" feature, reading generated summaries out loud without needing an external third-party server.
*   **Web Speech API (SpeechRecognition)**: Used for the "Voice Input" chat microphone mechanism.

### Backend (Server-Side)
*   **Python 3.10+**: Core backend programming language.
*   **FastAPI**: The asynchronous web framework used for building the API endpoints. Extremely fast and highly performant.
*   **Uvicorn**: An ASGI web server implementation used to physically serve the FastAPI application locally.
*   **Google Generative AI SDK (`google-generativeai`)**: The official Python SDK acting as the bridge to interact with our LLMs.
*   **PyMuPDF & python-docx**: Libraries utilized for local OCR (Optical Character Recognition) and text extraction from complex `.pdf` and `.docx` file uploads.
*   **BeautifulSoup4 & Requests**: Powers the `scraper.py` module, which takes an internet URL, fetches the HTML, and rips out the clean textual content so that Gemini can summarize websites.

### Artificial Intelligence & Models
*   **Google Gemini 2.5 Flash Lite (`gemini-2.5-flash-lite`)**: Our core brains. This model is engineered to be incredibly fast, natively multimodal, and has contextual intelligence to evaluate tone, size, and document style accurately.
*   **Google Gemini Embedding 001 (`models/gemini-embedding-001`)**: Used exclusively by the RAG backend to mathematically encode document text chunks into 768-dimensional dense vectors.
*   **Gemini File API**: For heavy multi-modal formats (Audio files `.mp3`, images `.png`), the backend utilizes Google's explicit File API to upload the file for cloud-native extraction and understanding, bypassing standard text extraction locally.
*   **Vector Database & Retrieval-Augmented Generation (RAG)**: Uses custom `rag.py` local indexing. Before chatting, the text is extracted, chunked, and embedded into vectors. For server-side storage without a bloated database, it uses a highly efficient **Pickle-based Local Vector Database** (`rag_db.pkl`) serialized to the local disk. When a user queries, it calculates the **Cosine Similarity** via Numpy arrays to fetch the closest semantic vector representations, providing ground-truth context to the LLM and eliminating hallucinations.
*   **Persistent JSON Storage**: For tracking consumption metrics globally, `stats.json` maintains real-time records. (Note: Future Auth & History UI implementations are staged in `requirements.txt` with PyJWT/SQLAlchemy to extend the database architecture).


---

## 3. Core Features & Capabilities

Use these exact terms and outlines when creating your "Results" or "Functionality" sections of the thesis:

1.  **Multimodal Document Ingestion Pipeline**: Can process `.txt`, `.docx`, `.pdf`, `.jpg`, `.png`, and even audio files like `.mp3`.
2.  **Web Scraper Integration**: Bypasses local files entirely; users can paste a URL and the system scrapes the internet content to build a summary.
3.  **Real-time Streaming Engine (SSE)**: Instead of the user waiting 30 seconds for a blank screen, the backend leverages Server-Sent Events to stream LLM tokens directly to the UI, creating a fluid "typing" effect.
4.  **Responsible AI (RAI) Trust & Bias Scoring**: A bespoke algorithm within the LLM prompt instructions that forces the AI to objectively evaluate the source intrinsic reliability, bias, and authority, computing a deterministic "Trust Score" (0-100) reflecting factual accuracy weight.
5.  **Multi-Language Translation Engine**: Directly built into the extraction path to instantly shift summaries to English, Hindi, or Sanskrit.
6.  **Interactive Real-time Chat Q&A**: A sticky sliding window that lets users ask questions *against* the document context, heavily utilizing the custom RAG index.
7.  **Auto-generated Smart Prompts**: The AI evaluates its own responses and generates 3 highly intelligent suggested follow-up questions for the user to explore the document further without typing.
8.  **Global Admin Analytics Dashboard**: Logs every processed document and chat securely. Displays live metrics cleanly utilizing the `Chart.js` integration.
9.  **QR-Code Mobile Handover**: Live summaries generate ephemeral share IDs (`ShareRequest` model) which are injected into a QR code, allowing users to scan on their phone and resume reading on mobile.

---

## 4. UI/UX & Design Philosophy

For the "Frontend Design" aspect of the thesis:
*   **Design Tokens & CSS Variables**: Clean separation of color palettes (Backgrounds, Accents, Text mapping).
*   **Dynamic Theming**: Support for 4 live themes: Midnight, Daylight, Cyberpunk, and Forest.
*   **Micro-interactions**: Hover lifts on cards (`transform: translateY`), animated gradient text backgrounds (`background-clip: text`), and glowing badge elements (`.keyword-badge`) to create a premium, 2026-era SaaS application feel.
*   **Loading State Machine**: Implemented "Scanning" bars and loaders to cognitively reassure the user during network latency.
