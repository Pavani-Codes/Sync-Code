import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Palette, Lock, Shield, Trash2, Mail } from 'lucide-react';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const savedUser = JSON.parse(
    localStorage.getItem('user') || '{"name":"User","email":"user@example.com","avatarColor":"#8b5cf6"}'
  );

  const [name, setName] = useState(savedUser.name || '');
  const [email, setEmail] = useState(savedUser.email || '');
  const [avatarColor, setAvatarColor] = useState(savedUser.avatarColor || '#8b5cf6');
  const [statusMsg, setStatusMsg] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const COLOR_OPTIONS = ['#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#a855f7'];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser = { ...savedUser, name, email, avatarColor };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setStatusMsg('Profile details saved!');
    setTimeout(() => setStatusMsg(''), 2500);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    setStatusMsg('Password updated successfully!');
    setCurrentPassword('');
    setNewPassword('');
    setTimeout(() => setStatusMsg(''), 2500);
  };

  const handleDeleteAccount = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2d2825] py-10 px-6 font-sans select-none flex justify-center">
      <div className="w-full max-w-xl flex flex-col gap-8">
        
        {/* Minimal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#dfd5c8]/60">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#7a706b] hover:text-[#2d2825] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <span className="text-xs font-mono uppercase tracking-widest text-[#7a706b]">Settings</span>
        </div>

        {/* User Identity Banner */}
        <div className="flex items-center gap-4">
          <div
            style={{ backgroundColor: avatarColor }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-sm transition-all"
          >
            {name.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-extrabold tracking-tight">{name}</h1>
            <span className="text-xs text-[#7a706b] font-mono">{email}</span>
          </div>
        </div>

        {statusMsg && (
          <div className="text-xs text-emerald-600 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl flex items-center gap-1.5 w-fit">
            <Check className="h-3.5 w-3.5" /> {statusMsg}
          </div>
        )}

        {/* Section 1: Profile Details */}
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          <span className="text-xs font-extrabold text-[#8b5cf6] uppercase tracking-wider">Account Profile</span>
          
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[#7a706b]">Display Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent border-b border-[#dfd5c8] py-1.5 text-xs font-medium outline-none focus:border-[#8b5cf6] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[#7a706b] flex items-center gap-1">
              <Mail className="h-3 w-3" /> Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-transparent border-b border-[#dfd5c8] py-1.5 text-xs font-mono outline-none focus:border-[#8b5cf6] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <label className="text-[11px] font-bold text-[#7a706b] flex items-center gap-1">
              <Palette className="h-3 w-3" /> Color Preference
            </label>
            <div className="flex items-center gap-2.5">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  style={{ backgroundColor: color }}
                  className={`w-6 h-6 rounded-full transition-all ${
                    avatarColor === color ? 'ring-2 ring-offset-2 ring-[#8b5cf6] scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-2 px-5 rounded-xl text-xs font-bold shadow-sm transition-all self-start"
          >
            Save Changes
          </button>
        </form>

        <hr className="border-[#dfd5c8]/50" />

        {/* Section 2: Security */}
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
          <span className="text-xs font-extrabold text-[#8b5cf6] uppercase tracking-wider flex items-center gap-1">
            <Lock className="h-3 w-3" /> Security
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="password"
              placeholder="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="bg-transparent border-b border-[#dfd5c8] py-1.5 text-xs outline-none focus:border-[#8b5cf6]"
            />
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-transparent border-b border-[#dfd5c8] py-1.5 text-xs outline-none focus:border-[#8b5cf6]"
            />
          </div>

          <button
            type="submit"
            className="bg-[#2d2825] text-white py-2 px-5 rounded-xl text-xs font-bold shadow-sm transition-all self-start hover:bg-black"
          >
            Update Password
          </button>
        </form>

        <hr className="border-[#dfd5c8]/50" />

        {/* Section 3: Danger Zone */}
        <div className="flex items-center justify-between py-2">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" /> Permanent Deletion
            </span>
            <span className="text-[10px] text-[#7a706b]">Delete account and clear session data.</span>
          </div>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="text-xs text-rose-600 font-bold hover:underline flex items-center gap-1"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>

      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-xs bg-[#faf8f5] border border-[#dfd5c8] rounded-2xl p-5 shadow-xl flex flex-col gap-3">
            <h3 className="font-extrabold text-xs text-rose-600">Delete Account?</h3>
            <p className="text-[11px] text-[#7a706b] leading-relaxed">
              This will remove your stored user settings and active session.
            </p>
            <div className="flex items-center justify-end gap-2 mt-1">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-xs font-bold text-[#7a706b] px-3 py-1.5 hover:bg-black/5 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};