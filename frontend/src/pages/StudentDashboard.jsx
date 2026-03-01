import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function StudentDashboard() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchCourses = async (uid) => {
    const q = query(
      collection(db, "courses"),
      where("students", "array-contains", uid)
    );

    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    setCourses(data);
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
      <div style={{ marginBottom: "3rem" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "700" }}>My Learning Workspace</h1>
        <p style={{ color: "var(--grey)", fontSize: "1.1rem" }}>
          Welcome back! Access your courses and study materials below.
        </p>
      </div>

      {courses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", backgroundColor: "#fff", borderRadius: "12px" }}>
          <p style={{ color: "var(--grey)", fontSize: "1.2rem" }}>You are not enrolled in any courses yet.</p>
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
              onClick={() => navigate(`/student/course/${course.id}`)}
              style={{ cursor: "pointer", display: "flex", flexDirection: "column", height: "100%" }}
            >
              <div style={{
                height: "8px",
                backgroundColor: "var(--primary)",
                margin: "-1.5rem -1.5rem 1.5rem -1.5rem",
                borderRadius: "8px 8px 0 0"
              }}></div>
              <h3 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>{course.title}</h3>
              <p style={{ color: "var(--grey)", fontSize: "0.95rem", flex: 1, marginBottom: "1.5rem" }}>
                {course.description || "No description available for this course."}
              </p>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1rem", borderTop: "1px solid #eee" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--primary)" }}>VIEW COURSE</span>
                {course.lectures && course.lectures.length > 0 && (
                  <span title="Contains Lectures" style={{ fontSize: "1.1rem" }}>📚</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StudentDashboard;
