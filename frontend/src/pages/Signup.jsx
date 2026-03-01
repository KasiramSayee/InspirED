import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        email,
        role,
        createdAt: new Date(),
      });

      alert("User registered successfully");
      navigate("/");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-side-info">
        <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>
          <span style={{ color: "var(--primary)" }}>Inspir</span>ED
        </h1>
        <h2 style={{ fontSize: "1.8rem", color: "var(--secondary)", fontWeight: "600" }}>
          Start your journey with us
        </h2>
        <p style={{ color: "var(--grey)", fontSize: "1.1rem", maxWidth: "400px" }}>
          Create an account to join the InspirED community and explore everything we have to offer.
        </p>
        <div style={{ marginTop: "3rem", opacity: 0.9 }}>
          {/* Using a reliable education illustration */}
          <img src="https://cdni.iconscout.com/illustration/premium/thumb/online-education-illustration-download-in-svg-png-gif-file-formats--learning-logo-course-study-student-pack-school-delivery-illustrations-4045543.png" alt="Auth Illustration" style={{ width: "100%", maxWidth: "400px", borderRadius: "12px" }} />
        </div>
      </div>

      <div className="login-side-form">
        <div className="form-container">
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1.5rem" }}>Create an account</h3>
          </div>

          <form onSubmit={handleSignup}>
            <div className="input-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "14px", marginTop: "1rem" }}>
              Sign up
            </button>
          </form>

          <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.9rem", color: "var(--grey)" }}>
            Already have an account? <Link to="/" style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
