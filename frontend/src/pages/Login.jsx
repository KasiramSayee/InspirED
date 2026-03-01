import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const role = docSnap.data().role;
          if (role === "admin") navigate("/admin");
          else if (role === "student") navigate("/student");
          else if (role === "teacher") navigate("/teacher");
        }
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const role = docSnap.data().role;
        if (role === "admin") navigate("/admin");
        else if (role === "student") navigate("/student");
        else if (role === "teacher") navigate("/teacher");
        else alert("Invalid role");
      } else {
        alert("User role not found");
      }
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
          Log in to your workspace
        </h2>
        <p style={{ color: "var(--grey)", fontSize: "1.1rem", maxWidth: "400px" }}>
          Enter your email and password to access your InspirED account. You are one step closer to boosting your productivity.
        </p>
        <div style={{ marginTop: "3rem", opacity: 0.9 }}>
          {/* Using a reliable high-quality photograph for the auth side panel */}
          <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000&auto=format&fit=crop" alt="Workspace" style={{ width: "100%", maxWidth: "450px", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }} />
        </div>
      </div>

      <div className="login-side-form">
        <div className="form-container">
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1.5rem" }}>Login to your account</h3>
          </div>

          <form onSubmit={handleLogin}>
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

            <div style={{ textAlign: "right", marginBottom: "1.5rem" }}>
              <Link to="/forgot" style={{ color: "var(--primary)", fontSize: "0.85rem", textDecoration: "none" }}>
                Forgot your password?
              </Link>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "14px" }}>
              Log in
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

export default LoginPage;
