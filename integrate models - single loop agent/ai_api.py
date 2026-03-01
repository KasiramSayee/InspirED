from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import asyncio
import os
import uuid
import traceback
from datetime import datetime, timedelta
import threading
import time
import json
import mcq_agent
from integration_main import process_question, process_question_stream

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access

# Directory for storing generated audio files
AUDIO_DIR = "./audio_output"
os.makedirs(AUDIO_DIR, exist_ok=True)

@app.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    """
    Streaming endpoint for AI chat (Server-Sent Events)
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No JSON data provided"}), 400
        
        pdf_url = data.get('pdfUrl')
        question = data.get('question')
        output_mode = data.get('outputMode', 'normal')
        learning_level = data.get('learningLevel', 3)
        language = data.get('language', 'en')
        
        if not pdf_url or not question:
            return jsonify({"success": False, "error": "pdfUrl and question are required"}), 400

        def generate():
            # Use a helper to run the async generator in the synchronous Flask route
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            gen = process_question_stream(pdf_url, question, output_mode, learning_level, language)
            
            try:
                while True:
                    try:
                        chunk = loop.run_until_complete(gen.__anext__())
                        if isinstance(chunk, dict):
                            yield f"data: {json.dumps(chunk)}\n\n"
                        else:
                            yield f"data: {json.dumps({'content': chunk})}\n\n"
                    except StopAsyncIteration:
                        break
            finally:
                loop.close()

        return Response(generate(), mimetype='text/event-stream')
        
    except Exception as e:
        print(f"[API] Stream Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Main endpoint for AI chat
    
    Request JSON:
    {
        "pdfUrl": "https://drive.google.com/...",
        "question": "What is SRS?",
        "outputMode": "interactive" | "analogy" | "normal",
        "language": "en"
    }
    
    Response JSON:
    {
        "success": true,
        "type": "text" | "audio",
        "content": "Answer text...",
        "audioUrl": "/audio/abc123.mp3",
        "processingTime": 5.2
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data:
            return jsonify({"success": False, "error": "No JSON data provided"}), 400
        
        pdf_url = data.get('pdfUrl')
        question = data.get('question')
        output_mode = data.get('outputMode', 'normal')
        learning_level = data.get('learningLevel', 3)
        language = data.get('language', 'en')
        
        if not pdf_url:
            return jsonify({"success": False, "error": "pdfUrl is required"}), 400
        if not question:
            return jsonify({"success": False, "error": "question is required"}), 400
        
        # Validate output mode
        if output_mode not in ['interactive', 'analogy', 'normal']:
            return jsonify({"success": False, "error": "Invalid outputMode"}), 400
        
        print(f"\n[API] Received request:")
        print(f"  PDF: {pdf_url[:50]}...")
        print(f"  Question: {question[:100]}...")
        print(f"  Mode: {output_mode}")
        print(f"  Level: {learning_level}")
        print(f"  Language: {language}")
        
        # Process the question (async function)
        start_time = time.time()
        result = asyncio.run(process_question(pdf_url, question, output_mode, learning_level, language))
        processing_time = time.time() - start_time
        
        result['processingTime'] = round(processing_time, 2)
        
        print(f"[API] Request processed in {processing_time:.2f}s")
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"[API] Error: {e}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/audio/<filename>', methods=['GET'])
def serve_audio(filename):
    """
    Serve generated MP3 audio files
    """
    try:
        file_path = os.path.join(AUDIO_DIR, filename)
        
        if not os.path.exists(file_path):
            return jsonify({"success": False, "error": "Audio file not found"}), 404
        
        return send_file(file_path, mimetype='audio/mpeg')
        
    except Exception as e:
        print(f"[API] Error serving audio: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "AI Tutoring API",
        "timestamp": datetime.now().isoformat()
    }), 200


def cleanup_old_audio_files():
    """
    Background task to clean up audio files older than 24 hours
    """
    while True:
        try:
            now = datetime.now()
            for filename in os.listdir(AUDIO_DIR):
                file_path = os.path.join(AUDIO_DIR, filename)
                
                # Check file age
                file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                if now - file_time > timedelta(hours=24):
                    os.remove(file_path)
                    print(f"[Cleanup] Removed old audio file: {filename}")
            
            # Run cleanup every hour
            time.sleep(3600)
            
        except Exception as e:
            print(f"[Cleanup] Error: {e}")
            time.sleep(3600)


# Start cleanup thread
cleanup_thread = threading.Thread(target=cleanup_old_audio_files, daemon=True)
cleanup_thread.start()


@app.route('/api/mcq', methods=['POST'])
def generate_mcq():
    """
    Endpoint for generating MCQs from PDF content
    
    Request JSON:
    {
        "pdfUrl": "https://drive.google.com/...",
        "numQuestions": 3
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No JSON data provided"}), 400
            
        pdf_url = data.get('pdfUrl')
        num_questions = data.get('numQuestions', 5)
        
        if not pdf_url:
            return jsonify({"success": False, "error": "pdfUrl is required"}), 400
            
        # 🟢 LOUD LOGGING FOR DEBUGGING
        print(f"\n🚀 [MCQ ROUTE] Handling request for: {pdf_url[:40]}...")
        
        # Process the MCQ generation (async function)
        start_time = time.time()
        result = asyncio.run(mcq_agent.generate_mcqs(pdf_url, num_questions))
        processing_time = time.time() - start_time
        
        result['processingTime'] = round(processing_time, 2)
        print(f"✅ [MCQ ROUTE] Request completed in {processing_time:.2f}s")
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"[API] MCQ Error: {e}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/mcq/analyze-performance', methods=['POST'])
def handle_analyze_performance():
    try:
        data = request.json
        if not data:
            return jsonify({"success": False, "error": "No JSON data provided"}), 400
            
        quiz_data = data.get('quizData')
        user_answers = data.get('userAnswers')
        
        if not quiz_data or not user_answers:
            return jsonify({"success": False, "error": "quizData and userAnswers are required"}), 400
            
        analysis = asyncio.run(mcq_agent.analyze_performance(quiz_data, user_answers))
        
        return jsonify({
            "success": True,
            "analysis": analysis
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print("AI Tutoring API Server Starting...")
    print("="*60)
    print(f"Server: http://localhost:5001")
    print(f"Endpoints:")
    print(f"   POST /api/chat - Process AI questions")
    print(f"   POST /api/chat/stream - Stream AI answers")
    print(f"   POST /api/mcq  - Generate MCQs")
    print(f"   GET  /audio/<filename> - Serve audio files")
    print(f"   GET  /health - Health check")
    print("="*60 + "\n")
    
    # Disable debug mode to prevent auto-reloading during requests
    app.run(host='0.0.0.0', port=5001, debug=False)
