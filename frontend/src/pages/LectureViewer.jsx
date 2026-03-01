import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useEffect, useState } from "react";
import { askAIQuestion, generateMcqs } from "../services/aiService";
import McqQuiz from "../components/McqQuiz";

function LectureViewer() {
    const { courseId, lectureIndex } = useParams();
    const navigate = useNavigate();
    const [lecture, setLecture] = useState(null);
    const [loading, setLoading] = useState(true);

    // AI Chat state
    const [messages, setMessages] = useState([]);
    const [question, setQuestion] = useState("");
    const [outputMode, setOutputMode] = useState("normal"); // will be overridden by student preference
    const [language, setLanguage] = useState("en");
    const [aiLoading, setAiLoading] = useState(false);

    // MCQ Quiz state
    const [showQuiz, setShowQuiz] = useState(false);
    const [quizQuestions, setQuizQuestions] = useState([]);
    const [mcqLoading, setMcqLoading] = useState(false);

    const studentId = auth.currentUser?.uid;

    useEffect(() => {
        const fetchLecture = async () => {
            try {
                const ref = doc(db, "courses", courseId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const courseData = snap.data();
                    const lec = courseData.lectures[lectureIndex];
                    if (lec) {
                        setLecture(lec);
                    } else {
                        alert("Lecture not found");
                        navigate(`/student/course/${courseId}`);
                    }
                } else {
                    alert("Course not found");
                    navigate("/student");
                }
            } catch (err) {
                alert("Error loading lecture: " + err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchLecture();
    }, [courseId, lectureIndex, navigate]);

    // Load student's learning preference and set as default output mode
    useEffect(() => {
        if (!studentId || !courseId) return;
        fetch(`http://localhost:5000/learning-patterns/${courseId}/${studentId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.pattern) {
                    // 'direct' maps to 'normal' in the AI chat API
                    const modeMap = { direct: 'normal', analogy: 'analogy', interactive: 'interactive' };
                    setOutputMode(modeMap[data.pattern] || 'normal');
                }
            })
            .catch(() => { }); // silently ignore if not found
    }, [courseId, studentId]);

    const handleAskQuestion = async () => {
        if (!question.trim() || aiLoading) return;

        // Add user message to chat
        const userMessage = { role: "user", content: question };
        setMessages(prev => [...prev, userMessage]);

        const currentQuestion = question;
        setQuestion("");
        setAiLoading(true);

        // For streaming, we need to add an empty message for the AI that we'll update
        const aiMessageId = messages.length + 1;
        setMessages(prev => [...prev, {
            role: "assistant",
            type: "text",
            content: "",
            source: "Thinking...",
            id: aiMessageId
        }]);

        try {
            const { askAIQuestionStream } = await import("../services/aiService");

            let fullContent = "";
            let messageType = "text";
            let audioUrl = null;
            let source = "Internet/General Knowledge";

            if (outputMode === "interactive") {
                // Interactive mode doesn't stream yet due to TTS
                const { askAIQuestion } = await import("../services/aiService");
                const response = await askAIQuestion(courseId, studentId, parseInt(lectureIndex), currentQuestion, outputMode, language);

                if (response.success) {
                    setMessages(prev => {
                        const newMsgs = [...prev];
                        newMsgs[newMsgs.length - 1] = {
                            role: "assistant",
                            type: response.type,
                            content: response.content,
                            source: response.source || "Course Material",
                            audioUrl: response.audioUrl ? `http://localhost:5000${response.audioUrl}` : null
                        };
                        return newMsgs;
                    });
                }
            } else {
                await askAIQuestionStream(
                    courseId,
                    studentId,
                    parseInt(lectureIndex),
                    currentQuestion,
                    outputMode,
                    language,
                    (chunk) => {
                        if (chunk.source) {
                            source = chunk.source;
                        }
                        if (chunk.content) {
                            fullContent += chunk.content;
                        }
                        if (chunk.type) {
                            messageType = chunk.type;
                        }
                        if (chunk.audioUrl) {
                            audioUrl = `http://localhost:5000${chunk.audioUrl}`;
                        }

                        // Update the last message
                        setMessages(prev => {
                            const newMsgs = [...prev];
                            newMsgs[newMsgs.length - 1] = {
                                ...newMsgs[newMsgs.length - 1],
                                content: fullContent,
                                source: source,
                                type: messageType,
                                audioUrl: audioUrl
                            };
                            return newMsgs;
                        });
                    }
                );
            }
        } catch (error) {
            setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = {
                    role: "assistant",
                    type: "text",
                    content: `Error: ${error.message}`,
                    source: "System Error"
                };
                return newMsgs;
            });
        } finally {
            setAiLoading(false);
        }
    };

    const handleGenerateMcq = async () => {
        if (mcqLoading) return;

        setMcqLoading(true);
        try {
            const response = await generateMcqs(courseId, parseInt(lectureIndex), 5);
            if (response.success && response.questions && response.questions.length > 0) {
                setQuizQuestions(response.questions);
                setShowQuiz(true);
            } else {
                alert("Failed to generate MCQs: " + (response.error || "No questions returned"));
            }
        } catch (err) {
            alert("Error generating MCQs: " + err.message);
        } finally {
            setMcqLoading(false);
        }
    };

    if (loading) return <div style={{ padding: "100px", textAlign: "center" }}><h3>Loading Lecture...</h3></div>;

    return (
        <div style={{ padding: "40px 5%", maxWidth: "1000px", margin: "0 auto" }}>
            {showQuiz && (
                <McqQuiz
                    questions={quizQuestions}
                    studentId={studentId}
                    courseId={courseId}
                    lectureIndex={parseInt(lectureIndex)}
                    onClose={() => setShowQuiz(false)}
                />
            )}

            <button
                className="nav-link"
                onClick={() => navigate(`/student/course/${courseId}`)}
                style={{ border: "none", background: "none", cursor: "pointer", marginBottom: "1rem", color: "var(--primary)" }}
            >
                &larr; Back to Course
            </button>

            <div style={{ backgroundColor: "#fff", padding: "3rem", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <h1 style={{ fontSize: "2rem", margin: 0 }}>{lecture.title}</h1>
                    <button
                        onClick={handleGenerateMcq}
                        disabled={mcqLoading}
                        className="btn btn-outline"
                        style={{
                            padding: "8px 20px",
                            borderColor: "var(--primary)",
                            color: "var(--primary)",
                            fontWeight: "600"
                        }}
                    >
                        {mcqLoading ? "Generating..." : "Practice MCQ"}
                    </button>
                </div>
                <p style={{ color: "var(--grey)", marginBottom: "2rem" }}>Lecture Material</p>

                {/* Top Section: View PDF */}
                <div style={{
                    padding: "3rem",
                    backgroundColor: "var(--light)",
                    borderRadius: "12px",
                    textAlign: "center",
                    border: "1px dashed #ccc",
                    marginBottom: "3rem"
                }}>
                    <span style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}>📄</span>
                    <h3 style={{ marginBottom: "1rem" }}>Study Material Available</h3>
                    <p style={{ marginBottom: "2rem", color: "var(--grey)" }}>Click below to open the lecture slides in a new tab.</p>
                    <a
                        href={lecture.link}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{ padding: "12px 30px", fontSize: "1.1rem" }}
                    >
                        Open PDF Slides
                    </a>
                </div>

                {/* Bottom Section: AI Chatbot */}
                <div style={{
                    borderTop: "1px solid #eee",
                    paddingTop: "2rem"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "1.5rem" }}>
                        <span style={{ fontSize: "1.8rem" }}>🤖</span>
                        <h3 style={{ margin: 0 }}>AI Tutor</h3>
                    </div>

                    {/* Output Mode Selector */}
                    <div style={{ marginBottom: "1.5rem" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                            Output Mode:
                        </label>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <button
                                onClick={() => setOutputMode("normal")}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: "6px",
                                    border: outputMode === "normal" ? "2px solid var(--primary)" : "2px solid #ddd",
                                    backgroundColor: outputMode === "normal" ? "#fff5f5" : "#fff",
                                    cursor: "pointer",
                                    fontWeight: outputMode === "normal" ? "600" : "normal"
                                }}
                            >
                                📝 Normal
                            </button>
                            <button
                                onClick={() => setOutputMode("analogy")}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: "6px",
                                    border: outputMode === "analogy" ? "2px solid var(--primary)" : "2px solid #ddd",
                                    backgroundColor: outputMode === "analogy" ? "#fff5f5" : "#fff",
                                    cursor: "pointer",
                                    fontWeight: outputMode === "analogy" ? "600" : "normal"
                                }}
                            >
                                💡 Analogy
                            </button>
                            <button
                                onClick={() => setOutputMode("interactive")}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: "6px",
                                    border: outputMode === "interactive" ? "2px solid var(--primary)" : "2px solid #ddd",
                                    backgroundColor: outputMode === "interactive" ? "#fff5f5" : "#fff",
                                    cursor: "pointer",
                                    fontWeight: outputMode === "interactive" ? "600" : "normal"
                                }}
                            >
                                🎙️ Interactive
                            </button>
                        </div>
                        {outputMode === "interactive" && (
                            <div style={{ marginTop: "10px" }}>
                                <label style={{ fontSize: "0.9rem", marginRight: "10px" }}>Language:</label>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    style={{ padding: "5px 10px", borderRadius: "4px", border: "1px solid #ddd" }}
                                >
                                    <option value="en">English</option>
                                    <option value="hi">Hindi</option>
                                    <option value="ta">Tamil</option>
                                    <option value="te">Telugu</option>
                                    <option value="es">Spanish</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Chat Messages */}
                    <div style={{
                        backgroundColor: "#f8f9fa",
                        borderRadius: "12px",
                        minHeight: "300px",
                        maxHeight: "400px",
                        overflowY: "auto",
                        padding: "1rem",
                        marginBottom: "1rem",
                        border: "1px solid #e9ecef"
                    }}>
                        {messages.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "2rem", color: "var(--grey)" }}>
                                <span style={{ fontSize: "2rem", display: "block", marginBottom: "1rem" }}>💬</span>
                                <p>Ask a question about this lecture!</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} style={{ marginBottom: "1rem" }}>
                                    {msg.role === "user" ? (
                                        <div style={{
                                            backgroundColor: "#e0e7ff",
                                            padding: "10px 15px",
                                            borderRadius: "10px",
                                            marginLeft: "20%",
                                            textAlign: "right"
                                        }}>
                                            <strong>You:</strong> {msg.content}
                                        </div>
                                    ) : (
                                        <div style={{
                                            backgroundColor: "#fff",
                                            padding: "10px 15px",
                                            borderRadius: "10px",
                                            marginRight: "20%",
                                            border: "1px solid #e9ecef"
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                                                <strong>AI Tutor:</strong>
                                                {msg.source && (
                                                    <span style={{
                                                        fontSize: "0.7rem",
                                                        backgroundColor: msg.source.includes("Course") ? "#c6f6d5" : "#edf2f7",
                                                        color: msg.source.includes("Course") ? "#22543d" : "#4a5568",
                                                        padding: "2px 6px",
                                                        borderRadius: "4px",
                                                        fontWeight: "bold"
                                                    }}>
                                                        Source: {msg.source}
                                                    </span>
                                                )}
                                            </div>
                                            {msg.type === "audio" ? (
                                                <div style={{ marginTop: "10px" }}>
                                                    <audio controls src={msg.audioUrl} style={{ width: "100%", marginBottom: "10px" }}>
                                                        Your browser does not support the audio element.
                                                    </audio>
                                                    <details style={{ fontSize: "0.9rem", color: "var(--grey)" }}>
                                                        <summary style={{ cursor: "pointer" }}>View transcript</summary>
                                                        <p style={{ marginTop: "10px", whiteSpace: "pre-wrap" }}>{msg.content}</p>
                                                    </details>
                                                </div>
                                            ) : (
                                                <p style={{ marginTop: "5px", whiteSpace: "pre-wrap" }}>{msg.content}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Question Input */}
                    <div style={{ display: "flex", gap: "10px" }}>
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && handleAskQuestion()}
                            placeholder="Ask a question about this lecture..."
                            disabled={aiLoading}
                            style={{
                                flex: 1,
                                padding: "12px",
                                borderRadius: "8px",
                                border: "1px solid #ddd",
                                fontSize: "1rem"
                            }}
                        />
                        <button
                            onClick={handleAskQuestion}
                            disabled={aiLoading || !question.trim()}
                            className="btn btn-primary"
                            style={{
                                padding: "12px 24px",
                                opacity: (aiLoading || !question.trim()) ? 0.5 : 1,
                                cursor: (aiLoading || !question.trim()) ? "not-allowed" : "pointer"
                            }}
                        >
                            {aiLoading ? "..." : "Send"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LectureViewer;
