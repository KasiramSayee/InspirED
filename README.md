# InspirED: Next-Gen AI Tutor & Learning Platform

InspirED is a comprehensive educational platform that leverages AI to provide personalized learning experiences. It features a React-based frontend, a Node.js backend, and a robust AI service powered by Ollama and RAG (Retrieval-Augmented Generation).

## 🚀 Key Features

- **Personalized AI Tutor**: Answers student questions based on uploaded course materials (PDFs).
- **Interactive Mode**: Conversational AI logic with Text-to-Speech (TTS) capabilities.
- **Agentic 3-Cycle Loop**: Ensuring pedagogical accuracy and zero hallucination through iterative cross-verification.
- **MCQ Generation**: Automatically generate quizzes from course content.
- **Performance Analytics**: Track student progress and identify weak topics.
- **Multilingual Support**: Support for English, Hindi, Tamil, Telugu, and Spanish.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, React Router, Recharts, Firebase.
- **Backend API**: Node.js, Express, Firebase Admin SDK.
- **AI Service**: Python (FastAPI/Flask-like architecture), Ollama (llama3.1:8b), ChromaDB (Vector Store).
- **TTS Engine**: Edge TTS with custom pedagogical logic.

## 📂 Project Structure

- `/frontend`: React application (Vite-based).
- `/backend`: Node.js Express server for user management and data persistence.
- `/integrate models - single loop agent`: Core AI Service handling RAG, MCQ, and Tutoring logic.
- `/chroma_store`: Local vector database storage.

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- [Ollama](https://ollama.com/) with `llama3.1:8b` model pulled.

### Installation

1. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

2. **Backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```

3. **AI Service**:
   ```bash
   cd "integrate models - single loop agent"
   pip install -r requirements.txt
   python ai_api.py
   ```

### Configuration
- Ensure your Firebase `serviceAccountKey.json` is present in the `backend/` directory.
- Ensure Ollama is running locally.

## 🔐 Security
The project is configured with a `.gitignore` to protect sensitive data like API keys and service accounts. Do not commit `serviceAccountkey.json`.
