import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

function CreateCourse() {
    const navigate = useNavigate();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(true);
    const [teacherId, setTeacherId] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                navigate("/", { replace: true });
                return;
            }
            setTeacherId(user.uid);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [navigate]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!title) {
            alert("Please enter a course title.");
            return;
        }

        try {
            const res = await fetch("http://localhost:5000/courses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, description, teacherId }),
            });

            const data = await res.json();
            if (data.courseId) {
                alert("Course created successfully!");
                navigate("/teacher");
            } else {
                alert(data.error || "Failed to create course");
            }
        } catch (err) {
            alert("Error creating course: " + err.message);
        }
    };

    if (loading) return <div style={{ padding: "100px", textAlign: "center" }}><h3>Loading...</h3></div>;

    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "calc(100vh - 70px)", padding: "20px" }}>
            <div className="form-container">
                <button
                    className="nav-link"
                    onClick={() => navigate("/teacher")}
                    style={{ border: "none", background: "none", cursor: "pointer", marginBottom: "1.5rem", color: "var(--primary)", padding: 0 }}
                >
                    &larr; Back to Dashboard
                </button>

                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                    <h2 style={{ fontSize: "1.8rem", color: "var(--secondary)" }}>Create New Course</h2>
                    <p style={{ color: "var(--grey)", fontSize: "0.9rem" }}>Launch a new learning space for your students.</p>
                </div>

                <form onSubmit={handleCreate}>
                    <div className="input-group">
                        <label>Course Title</label>
                        <input
                            type="text"
                            placeholder="e.g. Advanced Mathematics"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="input-group">
                        <label>Description</label>
                        <textarea
                            placeholder="What will students learn in this course?"
                            style={{
                                width: "100%",
                                padding: "12px",
                                border: "1.5px solid #eee",
                                borderRadius: "var(--border-radius)",
                                minHeight: "120px",
                                fontFamily: "inherit"
                            }}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "14px", marginTop: "1rem" }}>
                        Create Course
                    </button>
                </form>
            </div>
        </div>
    );
}

export default CreateCourse;
