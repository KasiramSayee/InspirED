import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { useEffect, useState } from "react";

function TeacherDashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = async (uid) => {
    const q = query(
      collection(db, "courses"),
      where("teacherId", "==", uid)
    );

    const snap = await getDocs(q);
    setCourses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/", { replace: true });
        return;
      }

      await fetchCourses(user.uid);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}><h3>Loading Dashboard...</h3></div>;

  return (
    <div style={{ padding: "40px 5%", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3rem" }}>
        <div>
          <h1 style={{ fontSize: "2.5rem", fontWeight: "700" }}>Teacher Central</h1>
          <p style={{ color: "var(--grey)", fontSize: "1.1rem" }}>
            Manage your courses and student enrollment from one place.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/create-course")}>
          + Create New Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", backgroundColor: "#fff", borderRadius: "12px" }}>
          <p style={{ color: "var(--grey)", fontSize: "1.2rem" }}>No courses created yet.</p>
          <button className="btn btn-outline" style={{ marginTop: "1rem" }} onClick={() => navigate("/create-course")}>
            Create your first course
          </button>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "2rem"
        }}>
          {courses.map(course => (
            <div
              key={course.id}
              className="card"
              onClick={() => navigate(`/teacher/course/${course.id}`)}
              style={{ cursor: "pointer", display: "flex", flexDirection: "column", height: "100%" }}
            >
              <div style={{
                height: "8px",
                backgroundColor: "var(--secondary)",
                margin: "-1.5rem -1.5rem 1.5rem -1.5rem",
                borderRadius: "8px 8px 0 0"
              }}></div>
              <h3 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>{course.title}</h3>
              <p style={{ color: "var(--grey)", fontSize: "0.95rem", flex: 1, marginBottom: "1.5rem" }}>
                {course.description || "No description provided."}
              </p>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1rem", borderTop: "1px solid #eee" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--secondary)" }}>MANAGE COURSE</span>
                <span style={{ fontSize: "0.85rem", color: "var(--grey)" }}>
                  {course.lectures && course.lectures.length > 0 && <span style={{ marginRight: "10px" }}>📚</span>}
                  {course.students?.length || 0} Students
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;
