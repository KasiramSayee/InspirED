import React, { useEffect, useState } from "react";

const API_BASE_URL = "http://localhost:5000";

function TeacherStudentResults({ courseId, lectureIndex, lectureTitle }) {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const url = lectureIndex !== undefined
                    ? `${API_BASE_URL}/courses/${courseId}/student-results?lectureIndex=${lectureIndex}`
                    : `${API_BASE_URL}/courses/${courseId}/student-results`;

                const res = await fetch(url);
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                setResults(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [courseId, lectureIndex]);

    if (loading) return <div style={{ padding: "20px", textAlign: "center" }}>Loading results for {lectureTitle || "course"}...</div>;
    if (error) return <div style={{ padding: "20px", color: "var(--primary)", textAlign: "center" }}>Error: {error}</div>;

    return (
        <div style={{ marginTop: "2rem", backgroundColor: "#fff", padding: "2rem", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
            <h3 style={{ marginBottom: "0.5rem" }}>👥 Student Performance — {lectureTitle || "Course Overview"}</h3>
            <p style={{ color: "var(--grey)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                {lectureIndex !== undefined
                    ? "Showing scores for this specific lecture quiz."
                    : "Showing average of the last 3 quiz attempts across the course."}
            </p>

            {results.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--grey)", fontStyle: "italic" }}>No students enrolled in this course yet.</p>
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead>
                            <tr style={{ borderBottom: "2px solid #eee" }}>
                                <th style={{ padding: "12px", fontSize: "0.9rem" }}>Student Email</th>
                                {lectureIndex !== undefined && <th style={{ padding: "12px", fontSize: "0.9rem" }}>Lecture Score</th>}
                                <th style={{ padding: "12px", fontSize: "0.9rem" }}>Course Avg (Last 3)</th>
                                <th style={{ padding: "12px", fontSize: "0.9rem" }}>Current Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((student, idx) => (
                                <tr key={idx} style={{ borderBottom: "1px solid #f9f9f9" }}>
                                    <td style={{ padding: "12px" }}>{student.email}</td>
                                    {lectureIndex !== undefined && (
                                        <td style={{ padding: "12px" }}>
                                            <span style={{
                                                fontWeight: "600",
                                                color: student.lectureScore === "Not Attempted" ? "#cbd5e1" : "var(--secondary)"
                                            }}>
                                                {student.lectureScore}
                                            </span>
                                        </td>
                                    )}
                                    <td style={{ padding: "12px" }}>
                                        <span style={{
                                            fontWeight: "600",
                                            color: student.averageScore === "Not Attempted" ? "#cbd5e1" : "var(--primary)"
                                        }}>
                                            {student.averageScore}
                                        </span>
                                    </td>
                                    <td style={{ padding: "12px" }}>
                                        <span style={{
                                            padding: "4px 10px",
                                            borderRadius: "20px",
                                            fontSize: "0.85rem",
                                            backgroundColor: student.learningLevel === "Not Assessed" ? "#f3f4f6" : "var(--secondary)",
                                            color: student.learningLevel === "Not Assessed" ? "#6b7280" : "#fff"
                                        }}>
                                            {student.learningLevel === "Not Assessed" ? "Not Assessed" : `Level ${student.learningLevel}`}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default TeacherStudentResults;
