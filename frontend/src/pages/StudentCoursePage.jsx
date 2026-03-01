import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useEffect, useState } from "react";
import LearningAssessment from "../components/LearningAssessment";
import McqQuiz from "../components/McqQuiz";
import { generateMcqs } from "../services/aiService";

function StudentCoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentChecked, setAssessmentChecked] = useState(false);

  // MCQ Quiz state
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [mcqLoading, setMcqLoading] = useState(false);
  const [loadingLectureIdx, setLoadingLectureIdx] = useState(null);

  const studentId = auth.currentUser?.uid;

  useEffect(() => {
    const fetchCourse = async () => {
      if (!studentId) return;

      try {
        const ref = doc(db, "courses", courseId);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setCourse(snap.data());
          // Check if learning pattern exists
          try {
            const res = await fetch(`http://localhost:5000/learning-patterns/${courseId}/${studentId}`);
            if (res.status === 404) {
              setShowAssessment(true);
            }
          } catch (err) {
            console.error("Error checking learning pattern", err);
          }
          setAssessmentChecked(true);
        } else {
          alert("Course not found");
          navigate("/student");
        }
      } catch (err) {
        alert("Error fetching course: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [courseId, navigate, studentId]);

  const handleGenerateMcq = async (lectureIdx) => {
    if (mcqLoading) return;

    setMcqLoading(true);
    setLoadingLectureIdx(lectureIdx);

    try {
      const response = await generateMcqs(courseId, lectureIdx, 3);
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
      setLoadingLectureIdx(null);
    }
  };

  if (showAssessment && !loading) {
    return (
      <LearningAssessment
        courseId={courseId}
        studentId={studentId}
        onComplete={() => setShowAssessment(false)}
      />
    );
  }

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}><h3>Loading Course Details...</h3></div>;

  return (
    <div style={{ padding: "40px 5%", maxWidth: "900px", margin: "0 auto" }}>
      <button className="nav-link" onClick={() => navigate("/student")} style={{ border: "none", background: "none", cursor: "pointer", marginBottom: "1rem", color: "var(--primary)" }}>
        &larr; Back to Dashboard
      </button>

      {showQuiz && (
        <McqQuiz
          questions={quizQuestions}
          studentId={studentId}
          courseId={courseId}
          lectureIndex={loadingLectureIdx}
          onClose={() => setShowQuiz(false)}
        />
      )}

      <div style={{ backgroundColor: "#fff", padding: "3rem", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{course.title}</h1>
        <p style={{ color: "var(--grey)", fontSize: "1.2rem", marginBottom: "2.5rem" }}>{course.description}</p>

        <div style={{ backgroundColor: "var(--light)", padding: "2rem", borderRadius: "8px", border: "1px solid #eee" }}>
          <h3 style={{ marginBottom: "1.5rem", color: "var(--secondary)" }}>Course Lectures</h3>
          {course.lectures && course.lectures.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {course.lectures.map((lec, idx) => (
                <div key={idx} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1.2rem",
                  backgroundColor: "#fff",
                  borderRadius: "10px",
                  border: "1px solid #eee",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    <span style={{ fontSize: "1.5rem" }}>📄</span>
                    <span style={{ fontWeight: "600", fontSize: "1.1rem" }}>{lec.title}</span>
                  </div>

                  <button
                    onClick={() => navigate(`/course/${courseId}/lecture/${idx}`)}
                    className="btn btn-primary"
                    style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
                  >
                    View Lecture
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <span style={{ fontSize: "2rem", display: "block", marginBottom: "10px" }}>⏳</span>
              <p style={{ color: "var(--grey)" }}>No lectures have been uploaded for this course yet. Check back later!</p>
            </div>
          )}
        </div>

        <div style={{ marginTop: "3rem", color: "var(--grey)", fontSize: "0.9rem", textAlign: "center" }}>
          Need help? Contact your instructor or visit the <span style={{ color: "var(--primary)", cursor: "pointer" }}>Help Center</span>.
        </div>
      </div>
    </div >
  );
}

export default StudentCoursePage;
