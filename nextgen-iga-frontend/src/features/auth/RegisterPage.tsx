import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { authApi } from "../../api/auth.api";
import toast from "react-hot-toast";

export function RegisterPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [generatedUid, setGeneratedUid] = useState("");

  // Logic to generate UID: first initial + last name
  const computeUid = (name: string) => {
    const names = name.trim().split(/\s+/);
    if (names.length < 1 || !names[0]) return "";
    const firstInitial = names[0][0].toLowerCase();
    const lastName = names.length > 1 ? names[names.length - 1].toLowerCase() : "user";
    return `${firstInitial}${lastName}`;
  };

  const currentUid = useMemo(() => computeUid(fullName), [fullName]);

  const handleRegister = async () => {
    if (!email || !password || !fullName) {
      const msg = "All fields are required";
      setError(msg);
      toast.error(msg, { position: "top-center" });
      return;
    }

    setLoading(true);
    setError("");
    try {
      const names = fullName.trim().split(/\s+/);
      const givenName = names[0];
      const sn = names.slice(1).join(" ") || "User";
      const uid = currentUid;

      await authApi.register({
        userId: uid,
        email,
        password,
        full_name: fullName,
        givenName,
        sn,
        role: "end_user"
      });

      // Track uid in localStorage so login gate works
      const pending: string[] = JSON.parse(localStorage.getItem('iga_pending_users') || '[]');
      if (!pending.includes(uid)) {
        localStorage.setItem('iga_pending_users', JSON.stringify([...pending, uid]));
      }

      setGeneratedUid(uid);
      setSuccess(true);
      toast.success("Registration successful! Pending administrator approval.", { position: "top-center" });
    } catch (err: any) {
      const msg = err?.response?.data?.message || (err instanceof Error ? err.message : "Registration failed");
      setError(msg);
      toast.error(msg, { position: "top-center" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#f8fafc',
      padding: 20,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Dynamic Background Elements */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50%', height: '50%', background: 'rgba(37, 99, 235, 0.05)', filter: 'blur(100px)', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '50%', height: '50%', background: 'rgba(79, 70, 229, 0.05)', filter: 'blur(100px)', borderRadius: '50%' }} />

      <div className="glass" style={{ 
        width: '100%', 
        maxWidth: 480, 
        padding: 40, 
        borderRadius: 28, 
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.05), 0 0 1px rgba(0,0,0,0.1)',
        zIndex: 1,
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ 
            width: 72, 
            height: 72, 
            background: 'var(--grad-primary)', 
            borderRadius: 20, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 20px',
            boxShadow: '0 12px 24px rgba(37, 99, 235, 0.2)'
          }}>
            <Shield size={36} color="#fff" />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-1px' }}>Join NextGen IGA</h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: 6, fontWeight: 500 }}>Create your enterprise identity</p>
        </div>

        {success ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ background: "#f0fdf4", border: '1px solid #dcfce7', padding: 24, borderRadius: 16, marginBottom: 24 }}>
              <h2 style={{ color: "#166534", marginBottom: 10, fontSize: '1.25rem', fontWeight: 800 }}>Registration Successful!</h2>
              <p style={{ color: '#14532d', fontSize: "1rem", fontWeight: 500 }}>
                Your account (<strong>{generatedUid}</strong>) is pending administrator approval.
              </p>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 24 }}>
              Once approved, sign in with your <strong>email address</strong> and password.
            </p>
            <button 
              className="btn btn-primary" 
              onClick={() => navigate("/login")} 
              style={{ width: '100%', height: 52, borderRadius: 14, fontWeight: 700, background: 'var(--grad-primary)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Go to Login
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ 
                background: '#fef2f2', 
                border: '1px solid #fee2e2', 
                color: '#b91c1c', 
                padding: '14px 18px', 
                borderRadius: 14, 
                fontSize: '0.875rem', 
                marginBottom: 28,
                textAlign: 'center',
                fontWeight: 500
              }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div className="form-group">
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Full Name</label>
                <input
                  className="form-input"
                  style={{ background: '#fff', border: '1.5px solid #e2e8f0', color: '#0f172a', padding: '14px 16px', borderRadius: 14, width: '100%', fontSize: '1rem' }}
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                {fullName && currentUid && (
                  <div style={{ marginTop: 10, fontSize: "0.85rem", padding: '8px 12px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <span style={{ color: '#15803d', fontWeight: 600 }}>
                      Your username (UID) will be: <strong>{currentUid}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Email Address</label>
                <input
                  className="form-input"
                  style={{ background: '#fff', border: '1.5px solid #e2e8f0', color: '#0f172a', padding: '14px 16px', borderRadius: 14, width: '100%', fontSize: '1rem' }}
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Password</label>
                <input
                  className="form-input"
                  style={{ background: '#fff', border: '1.5px solid #e2e8f0', color: '#0f172a', padding: '14px 16px', borderRadius: 14, width: '100%', fontSize: '1rem' }}
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                onClick={handleRegister}
                style={{
                  background: 'var(--grad-primary)',
                  border: 'none',
                  height: 52,
                  borderRadius: 14,
                  fontWeight: 700,
                  fontSize: '1rem',
                  boxShadow: '0 8px 20px rgba(37, 99, 235, 0.2)',
                  marginTop: 10,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {loading ? <span className="spinner" /> : "Create Identity Account"}
              </button>
            </div>

            <div style={{ textAlign: "center", marginTop: 40, fontSize: "0.95rem", color: '#64748b' }}>
              Already have an account? <Link to="/login" style={{ color: "var(--color-primary)", fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
