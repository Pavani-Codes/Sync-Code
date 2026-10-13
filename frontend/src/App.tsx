import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { EditorRoom } from './pages/EditorRoom';
import { Profile } from './pages/Profile';

export const App: React.FC = () => {
  useEffect(() => {
    if (!localStorage.getItem('user')) {
      localStorage.setItem(
        'user',
        JSON.stringify({ id: 'dev-123', name: 'Dev User', email: 'dev@synccode.com', avatarColor: '#8b5cf6' })
      );
      localStorage.setItem('token', 'dev-token-bypass');
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/room/:roomId" element={<EditorRoom />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};

export default App;