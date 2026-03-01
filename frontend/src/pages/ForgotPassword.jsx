import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate, Link } from "react-router-dom";

function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const navigate = useNavigate();

    const handleReset = async (e) => {
        e.preventDefault();
        try {
            await sendPasswordResetEmail(auth, email);
            setMessage("Password reset email sent! Check your inbox.");
            setTimeout(() => navigate("/"), 5000);
        } catch (error) {
            alert(error.message);
        }
    };

    return (
        <div className="login-page">
            <div className="login-side-info">
                <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>
                    <span style={{ color: "var(--primary)" }}>Inspir</span><span style={{ color: "var(--secondary)" }}>ED</span>
                </h1>
                <h2 style={{ fontSize: "1.8rem", color: "var(--secondary)", fontWeight: "600" }}>
                    Reset your password
                </h2>
                <p style={{ color: "var(--grey)", fontSize: "1.1rem", maxWidth: "400px" }}>
                    Enter your email address and we'll send you a link to reset your password.
                </p>
                <div style={{ marginTop: "3rem", opacity: 0.9 }}>
                    <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000&auto=format&fit=crop" alt="Workspace" style={{ width: "100%", maxWidth: "450px", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }} />
                </div>
            </div>

            <div className="login-side-form">
                <div className="form-container">
                    <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                        <h3 style={{ fontSize: "1.5rem" }}>Forgot Password</h3>
                    </div>

                    {message ? (
                        <div style={{ textAlign: "center", padding: "20px" }}>
                            <p style={{ color: "green", fontSize: "1rem", marginBottom: "1.5rem" }}>{message}</p>
                            <Link to="/" className="btn btn-primary" style={{ textDecoration: "none" }}>Back to Login</Link>
                        </div>
                    ) : (
                        <form onSubmit={handleReset}>
                            <div className="input-group">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "14px", marginTop: "1rem" }}>
                                Send Reset Link
                            </button>

                            <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.9rem", color: "var(--grey)" }}>
                                Remember your password? <Link to="/" style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>Log in</Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ForgotPassword;
