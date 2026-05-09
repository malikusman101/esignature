// ── ProfilePage ───────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import Sidebar from '../components/sidebar';
import SignaturePad from '../components/signature/SignaturePad';
import useAuthStore from '../store/authStore';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

export function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);
  const [form, setForm] = useState({ firstName: user?.firstName||'', lastName: user?.lastName||'', timezone: user?.timezone||'UTC' });
  const [pwForm, setPwForm] = useState({ currentPassword:'', newPassword:'' });
  const [loading, setLoading] = useState(false);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const { data } = await authAPI.updateMe(form);
      updateUser(data.data.user);
      toast.success('Profile updated!');
      setEditing(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleSavePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) return toast.error('Fill in both fields');
    if (pwForm.newPassword.length < 8) return toast.error('Password must be 8+ characters');
    setLoading(true);
    try {
      await authAPI.updateMe(pwForm);
      toast.success('Password changed!');
      setPwForm({ currentPassword:'', newPassword:'' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleSaveSignature = async (dataUrl) => {
    try {
      const { data } = await authAPI.updateMe({ signatureData: dataUrl });
      updateUser(data.data.user);
      setShowSigPad(false);
      toast.success('Signature saved!');
    } catch { toast.error('Failed to save signature'); }
  };

  const initials = user ? `${user.firstName?.[0]||''}${user.lastName?.[0]||''}`.toUpperCase() : '?';

  return (
    <div className="app-layout">
      <Sidebar/>
      <main className="main-content">
        <div className="page" style={{ maxWidth:700 }}>
          <h1 style={{ fontSize:26, fontWeight:700, marginBottom:24 }}>Profile Settings</h1>

          {/* Avatar + basic info */}
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
              <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:26, fontWeight:700, flexShrink:0 }}>{initials}</div>
              <div>
                <p style={{ fontSize:20, fontWeight:700 }}>{user?.firstName} {user?.lastName}</p>
                <p style={{ color:'var(--text-2)', fontSize:14 }}>{user?.email}</p>
                <span style={{ background:'#eff6ff', color:'#1e40af', padding:'2px 10px', borderRadius:99, fontSize:11, fontWeight:700, textTransform:'uppercase' }}>{user?.plan} plan</span>
              </div>
              <button className="btn btn-outline btn-sm" style={{ marginLeft:'auto' }} onClick={() => setEditing(!editing)}>
                {editing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
            {editing && (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">First Name</label>
                    <input className="form-input" value={form.firstName} onChange={e=>setForm(p=>({...p,firstName:e.target.value}))}/>
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Last Name</label>
                    <input className="form-input" value={form.lastName} onChange={e=>setForm(p=>({...p,lastName:e.target.value}))}/>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleSaveProfile} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          {/* Signature */}
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ fontSize:16, fontWeight:700 }}>Your Signature</h2>
              <button className="btn btn-outline btn-sm" onClick={()=>setShowSigPad(!showSigPad)}>
                {showSigPad ? 'Cancel' : user?.signatureData ? 'Change Signature' : 'Create Signature'}
              </button>
            </div>
            {user?.signatureData ? (
              <div style={{ background:'#f8fafc', borderRadius:10, padding:16, display:'flex', alignItems:'center', justifyContent:'center', minHeight:80 }}>
                <img src={user.signatureData} alt="Your signature" style={{ maxHeight:70, maxWidth:'100%', objectFit:'contain' }}/>
              </div>
            ) : (
              <div style={{ background:'#f8fafc', borderRadius:10, padding:20, textAlign:'center', color:'var(--text-3)' }}>
                No signature saved. Create one to sign documents faster.
              </div>
            )}
            {showSigPad && (
              <div style={{ marginTop:16 }}>
                <SignaturePad onSave={handleSaveSignature} onCancel={()=>setShowSigPad(false)} initialData={user?.signatureData}/>
              </div>
            )}
          </div>

          {/* Password */}
          <div className="card">
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>Change Password</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:380 }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Current Password</label>
                <input className="form-input" type="password" value={pwForm.currentPassword}
                  onChange={e=>setPwForm(p=>({...p,currentPassword:e.target.value}))}/>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" value={pwForm.newPassword}
                  onChange={e=>setPwForm(p=>({...p,newPassword:e.target.value}))}/>
              </div>
              <button className="btn btn-primary btn-sm" style={{ width:'fit-content' }} onClick={handleSavePassword} disabled={loading}>
                {loading ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── ForgotPasswordPage ────────────────────────────────────────────────────────
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setSent(true);
    } catch { toast.error('Something went wrong'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', fontFamily:'DM Sans,sans-serif', padding:24 }}>
      <div style={{ width:'100%', maxWidth:400, background:'#fff', borderRadius:16, padding:32, boxShadow:'var(--shadow-md)', border:'1px solid var(--border)' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:56,height:56,borderRadius:14,background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px' }}>
            <span style={{ fontSize:24 }}>🔑</span>
          </div>
          <h1 style={{ fontSize:22, fontWeight:700, marginBottom:6 }}>Reset your password</h1>
          {!sent && <p style={{ color:'var(--text-2)', fontSize:14 }}>Enter your email and we'll send you a reset link</p>}
        </div>
        {sent ? (
          <div style={{ textAlign:'center' }}>
            <p style={{ color:'var(--success)', fontWeight:600, marginBottom:8 }}>✅ Reset link sent!</p>
            <p style={{ color:'var(--text-2)', fontSize:14 }}>Check your email for a link to reset your password. The link expires in 1 hour.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input className="form-input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
        <p style={{ textAlign:'center', marginTop:16, fontSize:13 }}>
          <a href="/login" style={{ color:'var(--primary)', fontWeight:600 }}>← Back to Login</a>
        </p>
      </div>
    </div>
  );
}

// ── ResetPasswordPage ─────────────────────────────────────────────────────────
export function ResetPasswordPage() {
  const { token } = require('react-router-dom').useParams();
  const navigate = require('react-router-dom').useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return toast.error('Password must be 8+ characters');
    setLoading(true);
    try {
      await authAPI.resetPassword({ token, password });
      toast.success('Password reset! Please login.');
      navigate('/login');
    } catch (err) { toast.error(err.response?.data?.message || 'Invalid or expired link'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', fontFamily:'DM Sans,sans-serif', padding:24 }}>
      <div style={{ width:'100%', maxWidth:400, background:'#fff', borderRadius:16, padding:32, boxShadow:'var(--shadow-md)', border:'1px solid var(--border)' }}>
        <h1 style={{ fontSize:22, fontWeight:700, marginBottom:6 }}>Set new password</h1>
        <p style={{ color:'var(--text-2)', marginBottom:24, fontSize:14 }}>Must be at least 8 characters</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">New password</label>
            <input className="form-input" type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 8 characters"/>
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── VerifyEmailPage ───────────────────────────────────────────────────────────
export function VerifyEmailPage() {
  const { token } = require('react-router-dom').useParams();
  const [status, setStatus] = useState('loading');

  React.useEffect(() => {
    authAPI.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', fontFamily:'DM Sans,sans-serif', padding:24 }}>
      <div style={{ textAlign:'center', maxWidth:400 }}>
        {status === 'loading' && <><div className="spinner spinner-dark" style={{ width:40,height:40,margin:'0 auto 16px' }}/><p>Verifying...</p></>}
        {status === 'success' && (
          <>
            <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
            <h2 style={{ fontSize:24, fontWeight:700, marginBottom:8 }}>Email Verified!</h2>
            <p style={{ color:'var(--text-2)', marginBottom:24 }}>Your email has been verified. You can now use all features.</p>
            <a href="/login" className="btn btn-primary">Go to Login</a>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize:64, marginBottom:16 }}>❌</div>
            <h2 style={{ fontSize:24, fontWeight:700, marginBottom:8 }}>Verification Failed</h2>
            <p style={{ color:'var(--text-2)', marginBottom:24 }}>The verification link is invalid or has expired.</p>
            <a href="/login" className="btn btn-outline">Back to Login</a>
          </>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;