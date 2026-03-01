/**
 * AI Service - API client for AI chat functionality
 */

const API_BASE_URL = "http://localhost:5000";

/**
 * Ask a question to the AI tutor
 * 
 * @param {string} courseId - Course ID
 * @param {number} lectureIndex - Index of the lecture
 * @param {string} question - Student's question
 * @param {string} outputMode - "interactive" | "analogy" | "normal"
 * @param {string} language - Language code (default: "en")
 * @returns {Promise<Object>} Response from AI
 */
export async function askAIQuestion(courseId, studentId, lectureIndex, question, outputMode, language = "en") {
    try {
        const response = await fetch(`${API_BASE_URL}/ai/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                courseId,
                studentId,
                lectureIndex,
                question,
                outputMode,
                language,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to get AI response");
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("[AI Service] Error:", error);
        throw error;
    }
}

/**
 * Generate MCQs for a lecture
 * 
 * @param {string} courseId - Course ID
 * @param {number} lectureIndex - Index of the lecture
 * @param {number} numQuestions - Number of questions to generate
 * @returns {Promise<Object>} Response from AI with questions
 */
export async function generateMcqs(courseId, lectureIndex, numQuestions = 3) {
    try {
        const response = await fetch(`${API_BASE_URL}/ai/mcq`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                courseId,
                lectureIndex,
                numQuestions,
            }),
        });

        if (!response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to generate MCQs");
            } else {
                const text = await response.text();
                console.error("[AI Service] Received non-JSON error:", text.substring(0, 200));
                throw new Error(`Server returned error (${response.status}). Please check if the backend is running and updated.`);
            }
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("[AI Service] MCQ Error:", error);
        throw error;
    }
}

/**
 * Save quiz score to the database
 * 
 * @param {string} studentId - Student ID
 * @param {string} courseId - Course ID
 * @param {number} lectureIndex - Index of the lecture
 * @param {number} score - Score achieved
 * @param {number} total - Total possible score
 * @returns {Promise<Object>} Response from backend
 */
export async function saveQuizScore(studentId, courseId, lectureIndex, score, total, weakTopics = []) {
    try {
        const response = await fetch(`${API_BASE_URL}/ai/mcq/save-score`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                studentId,
                courseId,
                lectureIndex: Number(lectureIndex),
                score,
                total,
                weakTopics,
            }),
        });

        if (!response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to save quiz score");
            } else {
                const text = await response.text();
                console.error("[AI Service] Received non-JSON error during score save:", text.substring(0, 200));
                throw new Error(`Failed to save score (${response.status}).`);
            }
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("[AI Service] Save Score Error:", error);
        throw error;
    }
}

/**
 * Analyze student performance after a quiz
 * 
 * @param {Array} quizData - Array of question objects
 * @param {Object} userAnswers - Student's answers keyed by question ID
 * @returns {Promise<Object>} Analyzed performance data
 */
export async function analyzePerformance(quizData, userAnswers) {
    try {
        const response = await fetch(`${API_BASE_URL}/ai/mcq/analyze-performance`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                quizData,
                userAnswers,
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to analyze performance");
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("[AI Service] Analysis Error:", error);
        throw error;
    }
}

/**
 * Ask a question to the AI tutor with streaming response
 */
export async function askAIQuestionStream(courseId, studentId, lectureIndex, question, outputMode, language = "en", onChunk) {
    try {
        const response = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                courseId,
                studentId,
                lectureIndex,
                question,
                outputMode,
                language,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to start AI stream");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop(); // Keep last incomplete chunk

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        onChunk(data);
                    } catch (e) {
                        console.error("Error parsing stream chunk", e);
                    }
                }
            }
        }
    } catch (error) {
        console.error("[AI Service Stream] Error:", error);
        throw error;
    }
}

/**
 * Get audio URL for a given filename
 * 
 * @param {string} filename - Audio filename
 * @returns {string} Full URL to audio file
 */
export function getAudioUrl(filename) {
    return `${API_BASE_URL}/ai/audio/${filename}`;
}
