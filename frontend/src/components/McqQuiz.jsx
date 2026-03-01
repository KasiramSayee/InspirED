import React, { useState } from 'react';
import { saveQuizScore, analyzePerformance } from '../services/aiService';

const McqQuiz = ({ questions, studentId, courseId, lectureIndex, onClose }) => {
    const [userAnswers, setUserAnswers] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [saving, setSaving] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [activeTab, setActiveTab] = useState('performance'); // 'performance' or 'review'

    const handleOptionSelect = (questionId, option) => {
        if (submitted) return;
        setUserAnswers(prev => ({
            ...prev,
            [questionId]: option
        }));
    };

    const handleSubmit = async () => {
        if (Object.keys(userAnswers).length < questions.length) {
            alert("Please answer all questions before submitting.");
            return;
        }

        let newScore = 0;
        questions.forEach(q => {
            if (userAnswers[q.id] === q.correct_answer) {
                newScore++;
            }
        });

        setScore(newScore);
        setSubmitted(true);

        // 1. Get AI Performance Analysis FIRST so we have weak_topics for saving
        setAnalyzing(true);
        let weakTopics = [];
        try {
            const result = await analyzePerformance(questions, userAnswers);
            if (result.success) {
                setAnalysis(result.analysis);
                weakTopics = result.analysis?.weak_topics || [];
            }
        } catch (err) {
            console.error("Analysis failed:", err);
        } finally {
            setAnalyzing(false);
        }

        // 2. Save score + weak_topics to database
        if (studentId && courseId && lectureIndex !== undefined) {
            setSaving(true);
            try {
                await saveQuizScore(studentId, courseId, lectureIndex, newScore, questions.length, weakTopics);
            } catch (err) {
                console.error("Failed to save score:", err);
            } finally {
                setSaving(false);
            }
        }
    };

    // --- Sub-components for Report Card ---

    const ReportCard = () => {
        if (analyzing) return <div style={{ padding: '40px', textAlign: 'center' }}>Analyzing your performance...</div>;
        if (!analysis) return <div style={{ padding: '40px', textAlign: 'center' }}>No analysis available.</div>;

        return (
            <div style={{ animation: 'fadeIn 0.5s ease-in' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                    {/* Strengths Card */}
                    <div style={{ padding: '20px', backgroundColor: '#f0fff4', borderRadius: '12px', border: '1px solid #c6f6d5' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>💡</span>
                            <h3 style={{ margin: 0, color: '#2f855a' }}>Strengths</h3>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', color: '#276749' }}>
                            {analysis.strengths_desc || "You showed good grasp of the basic concepts."}
                        </p>
                    </div>

                    {/* Areas for Improvement */}
                    <div style={{ padding: '20px', backgroundColor: '#fff5f5', borderRadius: '12px', border: '1px solid #feb2b2' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>🎯</span>
                            <h3 style={{ margin: 0, color: '#c53030' }}>Areas for Improvement</h3>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', color: '#9b2c2c' }}>
                            {analysis.weaknesses_desc || "Focus more on the identified weak topics."}
                        </p>
                    </div>
                </div>

                {/* Recommended Topics */}
                <div style={{ marginBottom: '30px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <span style={{ fontSize: '1.2rem' }}>📖</span>
                        <h3 style={{ margin: 0 }}>Recommended Topics</h3>
                    </div>
                    {analysis.recommended_topics?.map((topic, i) => (
                        <div key={i} style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '10px', borderLeft: '4px solid var(--primary)' }}>
                            <h4 style={{ margin: '0 0 5px 0' }}>{topic.title}</h4>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>{topic.description}</p>
                        </div>
                    ))}
                </div>

                {/* Learning Path */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <span style={{ fontSize: '1.2rem' }}>🎓</span>
                        <h3 style={{ margin: 0 }}>Your Learning Path</h3>
                    </div>
                    <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '20px' }}>
                        {analysis.learning_path?.map((path, i) => (
                            <div key={i} style={{ marginBottom: i === analysis.learning_path.length - 1 ? 0 : '20px' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary)' }}>{path.title}</h4>
                                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                    {path.steps?.map((step, si) => (
                                        <li key={si} style={{ marginBottom: '5px', fontSize: '0.9rem' }}>{step}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: '#fff',
                width: '100%',
                maxWidth: '900px', // Slightly wider for report
                maxHeight: '90vh',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 30px',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ margin: 0, color: 'var(--primary)' }}>{submitted ? "Quiz Results" : "Quiz"}</h2>
                        {submitted && (
                            <div style={{ marginTop: '5px', color: '#666', fontSize: '0.9rem' }}>
                                Detailed Analysis & Report
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#999' }}
                    >
                        &times;
                    </button>
                </div>

                {/* Score Summary (Visible when submitted) */}
                {submitted && (
                    <div style={{
                        padding: '20px 30px',
                        backgroundColor: '#f8f9fa',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '40px',
                        borderBottom: '1px solid #eee'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{score}/{questions.length}</div>
                            <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Score</div>
                        </div>
                        <div style={{ flex: 1, backgroundColor: '#ddd', height: '12px', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${(score / questions.length) * 100}%`,
                                height: '100%',
                                backgroundColor: score / questions.length > 0.6 ? '#38a169' : '#e53e3e',
                                transition: 'width 1s ease-out'
                            }} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{Math.round((score / questions.length) * 100)}%</div>
                            <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Accuracy</div>
                        </div>
                    </div>
                )}

                {/* Tab Switcher */}
                {submitted && (
                    <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
                        <button
                            onClick={() => setActiveTab('performance')}
                            style={{
                                padding: '15px 30px', border: 'none', background: 'none', cursor: 'pointer',
                                borderBottom: activeTab === 'performance' ? '3px solid var(--primary)' : 'none',
                                color: activeTab === 'performance' ? 'var(--primary)' : '#666',
                                fontWeight: activeTab === 'performance' ? 'bold' : 'normal'
                            }}
                        >
                            📊 Performance Analysis
                        </button>
                        <button
                            onClick={() => setActiveTab('review')}
                            style={{
                                padding: '15px 30px', border: 'none', background: 'none', cursor: 'pointer',
                                borderBottom: activeTab === 'review' ? '3px solid var(--primary)' : 'none',
                                color: activeTab === 'review' ? 'var(--primary)' : '#666',
                                fontWeight: activeTab === 'review' ? 'bold' : 'normal'
                            }}
                        >
                            📝 Question Review
                        </button>
                    </div>
                )}

                {/* Content */}
                <div style={{
                    padding: '30px',
                    overflowY: 'auto',
                    flex: 1
                }}>
                    {!submitted ? (
                        questions.map((q, index) => (
                            <div key={q.id} style={{ marginBottom: '30px', borderBottom: index === questions.length - 1 ? 'none' : '1px solid #f0f0f0', paddingBottom: '20px' }}>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                    <span style={{ backgroundColor: 'var(--light)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold', alignSelf: 'flex-start' }}>
                                        Q{index + 1}
                                    </span>
                                    <h4 style={{ margin: 0, lineHeight: '1.4' }}>{q.question}</h4>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    {Object.entries(q.options).map(([letter, text]) => {
                                        const isSelected = userAnswers[q.id] === letter;
                                        return (
                                            <button
                                                key={letter}
                                                onClick={() => handleOptionSelect(q.id, letter)}
                                                style={{
                                                    padding: '12px 15px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                                                    border: isSelected ? '2px solid var(--primary)' : '1px solid #ddd',
                                                    backgroundColor: isSelected ? '#f0f4ff' : '#fff',
                                                    display: 'flex', alignItems: 'center', gap: '10px'
                                                }}
                                            >
                                                <span style={{ fontWeight: 'bold', color: isSelected ? 'var(--primary)' : '#666' }}>{letter}.</span>
                                                <span>{text}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    ) : (
                        activeTab === 'performance' ? <ReportCard /> : (
                            questions.map((q, index) => {
                                const isSelected = userAnswers[q.id] === q.correct_answer;
                                return (
                                    <div key={q.id} style={{ marginBottom: '20px', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
                                        <h4 style={{ margin: '0 0 10px 0' }}>{index + 1}. {q.question}</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            {Object.entries(q.options).map(([letter, text]) => {
                                                const currentSelected = userAnswers[q.id] === letter;
                                                const isCorrect = q.correct_answer === letter;
                                                let bg = '#fff';
                                                let border = '1px solid #eee';
                                                if (isCorrect) { bg = '#e6fffa'; border = '2px solid #38a169'; }
                                                else if (currentSelected) { bg = '#fff5f5'; border = '2px solid #e53e3e'; }

                                                return (
                                                    <div key={letter} style={{ padding: '10px', borderRadius: '8px', border, backgroundColor: bg, fontSize: '0.9rem' }}>
                                                        <strong>{letter}.</strong> {text}
                                                        {isCorrect && <span style={{ float: 'right' }}>✓</span>}
                                                        {currentSelected && !isCorrect && <span style={{ float: 'right' }}>✗</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px 30px',
                    borderTop: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    {!submitted ? (
                        <>
                            <div style={{ color: '#666' }}>{Object.keys(userAnswers).length} of {questions.length} answered</div>
                            <button onClick={handleSubmit} className="btn btn-primary" style={{ padding: '10px 30px' }} disabled={saving}>
                                {saving ? "Saving..." : "Submit & Analyze"}
                            </button>
                        </>
                    ) : (
                        <button onClick={onClose} className="btn btn-primary" style={{ padding: '10px 40px', margin: '0 auto' }}>
                            Close Report
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default McqQuiz;
