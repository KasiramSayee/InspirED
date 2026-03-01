import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";

function AdminDashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/", { replace: true });
        return;
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const createUser = async () => {
    if (!email || !password) {
      alert("Please fill in all fields.");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await res.json();
      alert(data.message || data.error);
      if (data.message) {
        setEmail("");
        setPassword("");
      }
    } catch (err) {
      alert("Failed to create user: " + err.message);
    }
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}><h3>Loading Dashboard...</h3></div>;

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "calc(100vh - 70px)", padding: "20px" }}>
      <div className="form-container">
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.8rem", color: "var(--secondary)" }}>Admin Dashboard</h2>
          <p style={{ color: "var(--grey)", fontSize: "0.9rem" }}>Create new teacher or student accounts.</p>
        </div>

        <div className="input-group">
          <label>Email Address</label>
          <input
            type="email"
            placeholder="example@inspired.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>Initial Password</label>
          <input
            type="password"
            placeholder="Set a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>Assign Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
        </div>

        <button className="btn btn-primary" style={{ width: "100%", padding: "14px", marginTop: "1rem" }} onClick={createUser}>
          Generate Account
        </button>
      </div>
    </div>
  );
}

export default AdminDashboard;
