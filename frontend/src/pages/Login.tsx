import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CodeXml, Lock, Mail, ArrowRight, KeyRound, X } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password Modal State
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1); // 1: Send OTP, 2: Reset Password
  const [forgotMsg, setForgotMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendForgotOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg('');
    try {
      const res = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setForgotStep(2);
      setForgotMsg('OTP sent to your email address!');
    } catch (err: any) {
      setForgotMsg(err.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg('');
    try {
      const res = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: forgotOtp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      alert('Password reset successful! Please log in with your new password.');
      setIsForgotOpen(false);
      setForgotStep(1);
    } catch (err: any) {
      setForgotMsg(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2d2825] flex items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-md bg-[#f2ece4] border border-[#dfd5c8] rounded-3xl p-8 shadow-xl flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[#8b5cf6]">
            <CodeXml className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
          <p className="text-xs text-[#7a706b]">Log in to your SyncCode account to start collaborating</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#7a706b]">Email address</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 h-4 w-4 text-[#7a706b]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#faf8f5] border border-[#dfd5c8] rounded-2xl py-2.5 pl-10 pr-4 text-xs outline-none focus:border-[#8b5cf6] transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#7a706b]">Password</label>
              <button
                type="button"
                onClick={() => setIsForgotOpen(true)}
                className="text-xs text-[#8b5cf6] font-bold hover:underline"
              >
                Forgot?
              </button>
            </div>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 h-4 w-4 text-[#7a706b]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#faf8f5] border border-[#dfd5c8] rounded-2xl py-2.5 pl-10 pr-4 text-xs outline-none focus:border-[#8b5cf6] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-3 rounded-2xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Sign In'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="text-center text-xs text-[#7a706b]">
          Don't have an account?{' '}
          <Link to="/signup" className="text-[#8b5cf6] font-bold hover:underline">
            Sign up
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-[#f2ece4] border border-[#dfd5c8] rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <KeyRound className="h-4 w-4 text-[#8b5cf6]" /> Reset Password
              </div>
              <button onClick={() => setIsForgotOpen(false)} className="opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {forgotMsg && (
              <div className="p-2.5 bg-black/5 border border-[#dfd5c8] text-xs rounded-xl font-medium text-center">
                {forgotMsg}
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleSendForgotOTP} className="flex flex-col gap-3">
                <input
                  type="email"
                  required
                  placeholder="Enter registered email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="bg-[#faf8f5] border border-[#dfd5c8] rounded-xl px-3 py-2 text-xs outline-none"
                />
                <button type="submit" className="bg-[#8b5cf6] text-white py-2 rounded-xl text-xs font-bold">
                  Send OTP
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
                <input
                  type="text"
                  required
                  placeholder="Enter 6-digit OTP"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  className="bg-[#faf8f5] border border-[#dfd5c8] rounded-xl px-3 py-2 text-xs outline-none font-mono text-center tracking-widest"
                />
                <input
                  type="password"
                  required
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-[#faf8f5] border border-[#dfd5c8] rounded-xl px-3 py-2 text-xs outline-none"
                />
                <button type="submit" className="bg-[#8b5cf6] text-white py-2 rounded-xl text-xs font-bold">
                  Reset Password
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};