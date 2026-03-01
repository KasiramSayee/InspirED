import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { useEffect, useState } from "react";
import TeacherAnalytics from "../components/TeacherAnalytics";
import TeacherStudentResults from "../components/TeacherStudentResults";
import CourseStudentOverview from "../components/CourseStudentOverview";

function TeacherCoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [lectures, setLectures] = useState([]);
  const [newLectureTitle, setNewLectureTitle] = useState("");
  const [newLectureLink, setNewLectureLink] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedLectureAnalyticsIndex, setSelectedLectureAnalyticsIndex] = useState(null);
  const [selectedLectureResultsIndex, setSelectedLectureResultsIndex] = useState(null);

  const fetchCourse = async () => {
    const ref = doc(db, "courses", courseId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      alert("Course not found");
      navigate("/teacher");
      return;
    }

    const data = snap.data();

    if (data.teacherId !== auth.currentUser?.uid) {
      alert("Unauthorized access");
      navigate("/teacher");
      return;
    }

    setCourse(data);
    setLectures(data.lectures || []);
    setLoading(false);
  };

  const addLecture = async () => {
    if (!newLectureTitle || !newLectureLink) {
      alert("Please provide both a title and a link for the lecture.");
      return;
    }

    const updatedLectures = [...lectures, { title: newLectureTitle, link: newLectureLink }];
    try {
      await updateDoc(doc(db, "courses", courseId), { lectures: updatedLectures });
      setLectures(updatedLectures);
      setNewLectureTitle("");
      setNewLectureLink("");
      alert("Lecture added successfully!");
    } catch (err) {
      alert("Failed to add lecture: " + err.message);
    }
  };

  const removeLecture = async (index) => {
    const updatedLectures = lectures.filter((_, i) => i !== index);
    try {
      await updateDoc(doc(db, "courses", courseId), { lectures: updatedLectures });
      setLectures(updatedLectures);
      if (selectedLectureAnalyticsIndex === index) setSelectedLectureAnalyticsIndex(null);
      if (selectedLectureResultsIndex === index) setSelectedLectureResultsIndex(null);
    } catch (err) {
      alert("Failed to remove lecture: " + err.message);
    }
  };

  const addStudent = async () => {
    if (!studentEmail) return;

    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", studentEmail),
        where("role", "==", "student")
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        alert("Student with this email not found.");
        return;
      }

      const studentId = snap.docs[0].id;
      await updateDoc(doc(db, "courses", courseId), {
        students: arrayUnion(studentId)
      });

      alert("Student enrolled successfully!");
      setStudentEmail("");
      fetchCourse();
    } catch (err) {
      alert("Error enrolling student: " + err.message);
    }
  };

  const deleteCourse = async () => {
    if (!window.confirm("Are you sure you want to delete this course forever?")) return;

    await deleteDoc(doc(db, "courses", courseId));
    alert("Course deleted successfully.");
    navigate("/teacher");
  };

  useEffect(() => {
    fetchCourse();
  }, [courseId]);

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}><h3>Loading Course...</h3></div>;

  return (
    <div style={{ padding: "40px 5%", maxWidth: "1100px", margin: "0 auto" }}>
      <button className="nav-link" onClick={() => navigate("/teacher")} style={{ border: "none", background: "none", cursor: "pointer", marginBottom: "1rem", color: "var(--primary)" }}>
        &larr; Back to Dashboard
      </button>

      <div style={{ backgroundColor: "#fff", padding: "3rem", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{course.title}</h1>
        <p style={{ color: "var(--grey)", fontSize: "1.2rem", marginBottom: "2rem" }}>{course.description}</p>

        {/* ─── NEW: Course-Wide Student Insights ─── */}
        <CourseStudentOverview courseId={courseId} />

        {/* ─── Manage Lectures ─── */}
        <div style={{ borderTop: "1px solid #eee", paddingTop: "2rem" }}>
          <h3 style={{ marginBottom: "1.5rem" }}>Manage Course Lectures</h3>

          <div style={{ marginBottom: "2rem" }}>
            <div className="input-group" style={{ marginBottom: "1rem" }}>
              <label>Lecture Title</label>
              <input style={{ flex: 1 }}
                value={newLectureTitle}
                onChange={e => setNewLectureTitle(e.target.value)}
                placeholder="  e.g. Introduction to Physics"
              />
            </div>
            <div className="input-group">
              <label>Google Drive PDF Link</label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  style={{ flex: 1 }}
                  value={newLectureLink}
                  onChange={e => setNewLectureLink(e.target.value)}
                  placeholder="   https://drive.google.com/..."
                />
                <button className="btn btn-secondary" onClick={addLecture}>Add Lecture</button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "2rem" }}>
            <h4 style={{ marginBottom: "1rem" }}>
              Current Lectures
              <span style={{ marginLeft: "10px", fontSize: "0.8rem", fontWeight: "normal", color: "var(--grey)" }}>
                — click Analytics or Results to view performance
              </span>
            </h4>
            {lectures.length === 0 ? (
              <p style={{ color: "var(--grey)", fontStyle: "italic" }}>No lectures added yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {lectures.map((lec, idx) => {
                  const isSelectedAnalytics = selectedLectureAnalyticsIndex === idx;
                  const isSelectedResults = selectedLectureResultsIndex === idx;
                  const isAnySelected = isSelectedAnalytics || isSelectedResults;

                  return (
                    <li key={idx} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "1rem 1.2rem",
                      backgroundColor: isAnySelected ? "#f0f4ff" : "#f9f9f9",
                      borderRadius: "8px",
                      marginBottom: "0.5rem",
                      border: isAnySelected ? "2px solid var(--primary)" : "1px solid #eee",
                      transition: "all 0.2s"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{
                          width: "28px", height: "28px", borderRadius: "50%",
                          backgroundColor: isAnySelected ? "var(--primary)" : "#e5e7eb",
                          color: isAnySelected ? "#fff" : "#374151",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.8rem", fontWeight: "bold", flexShrink: 0
                        }}>{idx + 1}</span>
                        <div>
                          <strong style={{ display: "block", color: isAnySelected ? "var(--primary)" : "inherit" }}>{lec.title}</strong>
                          <a href={lec.link} target="_blank" rel="noreferrer"
                            style={{ fontSize: "0.85rem", color: "var(--primary)" }}>View PDF</a>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                          onClick={() => {
                            setSelectedLectureAnalyticsIndex(isSelectedAnalytics ? null : idx);
                            setSelectedLectureResultsIndex(null);
                          }}
                          className="btn"
                          style={{
                            padding: "6px 12px",
                            fontSize: "0.80rem",
                            backgroundColor: isSelectedAnalytics ? "var(--primary)" : "#fff",
                            color: isSelectedAnalytics ? "#fff" : "var(--primary)",
                            border: "1px solid var(--primary)",
                            borderRadius: "6px",
                            cursor: "pointer"
                          }}
                        >
                          {isSelectedAnalytics ? "📊 Hide Analytics" : "📊 Analytics"}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLectureResultsIndex(isSelectedResults ? null : idx);
                            setSelectedLectureAnalyticsIndex(null);
                          }}
                          className="btn"
                          style={{
                            padding: "6px 12px",
                            fontSize: "0.80rem",
                            backgroundColor: isSelectedResults ? "var(--secondary)" : "#fff",
                            color: isSelectedResults ? "#fff" : "var(--secondary)",
                            border: "1px solid var(--secondary)",
                            borderRadius: "6px",
                            cursor: "pointer"
                          }}
                        >
                          {isSelectedResults ? "🏆 Hide Results" : "🏆 Results"}
                        </button>
                        <button
                          onClick={() => removeLecture(idx)}
                          style={{ backgroundColor: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.85rem", padding: "8px" }}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ─── Inline Panels ─── */}
          {selectedLectureAnalyticsIndex !== null && (
            <TeacherAnalytics
              courseId={courseId}
              lectureIndex={selectedLectureAnalyticsIndex}
              lectureTitle={lectures[selectedLectureAnalyticsIndex]?.title || `Lecture ${selectedLectureAnalyticsIndex + 1}`}
            />
          )}

          {selectedLectureResultsIndex !== null && (
            <TeacherStudentResults
              courseId={courseId}
              lectureIndex={selectedLectureResultsIndex}
              lectureTitle={lectures[selectedLectureResultsIndex]?.title || `Lecture ${selectedLectureResultsIndex + 1}`}
            />
          )}
        </div>
      </div>

      {/* ─── Enroll Students ─── */}
      <div style={{ marginTop: "3rem", borderTop: "1px solid #eee", paddingTop: "2rem" }}>
        <h3 style={{ marginBottom: "1.5rem" }}>Enroll Students</h3>
        <div className="input-group">
          <label>Student Email Address</label>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              style={{ flex: 1 }}
              value={studentEmail || ""}
              onChange={e => setStudentEmail(e.target.value)}
              placeholder=" student@inspired.com"
            />
            <button className="btn btn-primary" onClick={addStudent}>Enroll Student</button>
          </div>
        </div>
        <div style={{ marginTop: "1rem", color: "var(--grey)", fontSize: "0.9rem" }}>
          Currently enrolled: <strong>{course.students?.length || 0} students</strong>
        </div>
      </div>

      {/* ─── Danger Zone ─── */}
      <div style={{ marginTop: "4rem", paddingTop: "2rem", borderTop: "1px solid #fee2e2" }}>
        <button className="btn btn-outline" style={{ borderColor: "#ef4444", color: "#ef4444" }} onClick={deleteCourse}>
          Delete This Course
        </button>
      </div>
    </div>
  );
}

export default TeacherCoursePage;
