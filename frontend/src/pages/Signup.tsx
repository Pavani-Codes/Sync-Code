import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CodeXml, Lock, Mail, User, ArrowRight } from 'lucide-react';

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');

      // Automatically store token & user profile, then jump straight to dashboard
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2d2825] flex items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-md bg-[#f2ece4] border border-[#dfd5c8] rounded-3xl p-8 shadow-xl flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[#8b5cf6]">
            <CodeXml className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Create an account</h1>
          <p className="text-xs text-[#7a706b]">Join SyncCode and build projects in real time</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#7a706b]">Full Name</label>
            <div className="relative flex items-center">
              <User className="absolute left-3.5 h-4 w-4 text-[#7a706b]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className="w-full bg-[#faf8f5] border border-[#dfd5c8] rounded-2xl py-2.5 pl-10 pr-4 text-xs outline-none focus:border-[#8b5cf6] transition-colors"
              />
            </div>
          </div>

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
            <label className="text-xs font-bold text-[#7a706b]">Password</label>
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
            {loading ? 'Creating account...' : 'Sign Up'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="text-center text-xs text-[#7a706b]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#8b5cf6] font-bold hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
};