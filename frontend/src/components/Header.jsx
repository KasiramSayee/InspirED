import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

function Header({ user }) {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/", { replace: true });
    };

    return (
        <header className="main-header">
            <Link to="/" className="logo" style={{ textDecoration: "none" }}>
                <span>
                    <span style={{ color: "var(--primary)" }}>Inspir</span>
                    <span style={{ color: "var(--secondary)" }}>ED</span>
                </span>
            </Link>

            {/*<nav className="nav-links">
               
                <Link to="/" className="nav-link">Home</Link>
            </nav>*/}

            <div className="auth-actions" style={{ display: "flex", gap: "15px", alignItems: "center" }}>
                {user ? (
                    <>
                        <span style={{ fontSize: "0.85rem", color: "var(--grey)" }}>{user.email}</span>
                        <button onClick={handleLogout} className="btn btn-outline" style={{ padding: "8px 16px" }}>
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/" className="btn btn-primary" style={{ padding: "10px 30px" }}>
                            Login
                        </Link>
                    </>
                )}
            </div>
        </header>
    );
}

export default Header;
