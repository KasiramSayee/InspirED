import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Header from "./components/Header";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherCoursePage from "./pages/TeacherCoursePage";
import StudentDashboard from "./pages/StudentDashboard";
import StudentCoursePage from "./pages/StudentCoursePage";
import AdminDashboard from "./pages/AdminDashboard";
import CreateCourse from "./pages/CreateCourse";
import ForgotPassword from "./pages/ForgotPassword";
import LectureViewer from "./pages/LectureViewer";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="loading-screen"><h3>Loading...</h3></div>;

  return (
    <div className="app-container">
      <Header user={user} />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/create-course" element={<CreateCourse />} />
        <Route path="/teacher/course/:courseId" element={<TeacherCoursePage />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/course/:courseId" element={<StudentCoursePage />} />
        <Route path="/course/:courseId/lecture/:lectureIndex" element={<LectureViewer />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default App;
