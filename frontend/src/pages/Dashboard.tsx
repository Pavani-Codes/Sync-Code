import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { CodeXml, Plus, ArrowRight, Download, Clock, FolderGit2, LogOut, Trash2, X } from 'lucide-react';

interface RecentProject {
  roomId: string;
  name: string;
  lastOpened: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [roomIdInput, setRoomIdInput] = useState('');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  // Create Modal State for Project Naming
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customProjectName, setCustomProjectName] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{"name":"User","email":"user@example.com"}');

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('syncCode_recent_projects') || '[]');
    setRecentProjects(history);
  }, []);

  const saveToRecentProjects = (id: string, name?: string) => {
    const existing = JSON.parse(localStorage.getItem('syncCode_recent_projects') || '[]');
    const existingProj = existing.find((p: RecentProject) => p.roomId === id);
    const filtered = existing.filter((p: RecentProject) => p.roomId !== id);

    const projName = name?.trim() || existingProj?.name || `Project ${id}`;

    const updated = [
      { roomId: id, name: projName, lastOpened: new Date().toLocaleDateString() },
      ...filtered,
    ].slice(0, 8);

    localStorage.setItem('syncCode_recent_projects', JSON.stringify(updated));
    setRecentProjects(updated);
  };

  const handleConfirmCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const newRoomId = Math.random().toString(36).substring(2, 8);
    const projName = customProjectName.trim() || `Project ${newRoomId}`;
    
    saveToRecentProjects(newRoomId, projName);
    setIsCreateModalOpen(false);
    setCustomProjectName('');
    navigate(`/room/${newRoomId}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomIdInput.trim()) return;
    saveToRecentProjects(roomIdInput.trim());
    navigate(`/room/${roomIdInput.trim()}`);
  };

  const handleDeleteProject = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = recentProjects.filter((p) => p.roomId !== roomId);
    localStorage.setItem('syncCode_recent_projects', JSON.stringify(filtered));
    setRecentProjects(filtered);
  };

  const handleDownloadProjectZip = async (roomId: string, name: string) => {
    const zip = new JSZip();
    const srcFolder = zip.folder('src');

    srcFolder?.file(
      'index.js',
      `// SyncCode Export: ${name}\nconsole.log("App initialised!");`
    );
    srcFolder?.file('utils.js', 'export function add(a, b) { return a + b; }');
    zip.file('README.md', `# ${name}\nRoom ID: ${roomId}\nExported code files.`);

    const content = await zip.generateAsync({ type: 'blob' });
    const element = document.createElement('a');
    element.href = URL.createObjectURL(content);
    element.download = `${name.replace(/\s+/g, '_')}_${roomId}.zip`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2d2825] p-6 font-sans select-none flex flex-col items-center">
      <div className="w-full max-w-4xl flex flex-col gap-8">
        {/* Navbar */}
        <div className="flex items-center justify-between border-b border-[#dfd5c8] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[#8b5cf6]">
              <CodeXml className="h-6 w-6" />
            </div>
            <span className="font-extrabold text-xl tracking-wider">SyncCode</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 bg-[#f2ece4] border border-[#dfd5c8] px-3.5 py-1.5 rounded-2xl text-xs font-bold hover:scale-105 transition-all"
            >
              <div
                style={{ backgroundColor: user.avatarColor || '#8b5cf6' }}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white"
              >
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span>{user.name || 'Account'}</span>
            </button>

            <button
              onClick={() => {
                localStorage.clear();
                navigate('/login');
              }}
              className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Action Grid: Create or Join */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-[#f2ece4] border border-[#dfd5c8] rounded-3xl shadow-sm flex flex-col gap-4">
            <div className="p-3 bg-[#8b5cf6]/10 text-[#8b5cf6] rounded-2xl w-fit">
              <Plus className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold">Start New Workspace</h2>
            <p className="text-xs text-[#7a706b]">Generate a fresh room with a custom project name.</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-auto bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-3 rounded-2xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
            >
              Create Room <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="p-6 bg-[#f2ece4] border border-[#dfd5c8] rounded-3xl shadow-sm flex flex-col gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl w-fit">
              <FolderGit2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold">Join Existing Room</h2>
            <p className="text-xs text-[#7a706b]">Enter a unique Room ID to enter an active live code session.</p>
            <form onSubmit={handleJoinRoom} className="mt-auto flex gap-2">
              <input
                type="text"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                placeholder="Enter Room ID"
                className="flex-1 bg-[#faf8f5] border border-[#dfd5c8] rounded-2xl px-4 py-2 text-xs outline-none focus:border-[#8b5cf6]"
              />
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-md">
                Join
              </button>
            </form>
          </div>
        </div>

        {/* Recently Worked Projects Section */}
        <div className="p-6 bg-[#f2ece4] border border-[#dfd5c8] rounded-3xl shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Clock className="h-4 w-4 text-[#8b5cf6]" /> Recently Worked Projects
            </div>
            <span className="text-xs text-[#7a706b] font-mono">{recentProjects.length} projects</span>
          </div>

          {recentProjects.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#7a706b] italic">
              No recent projects yet. Create or join a room above to get started!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentProjects.map((proj) => (
                <div
                  key={proj.roomId}
                  className="p-4 bg-[#faf8f5] border border-[#dfd5c8] rounded-2xl flex items-center justify-between hover:border-[#8b5cf6] transition-colors"
                >
                  <div className="flex flex-col max-w-[55%]">
                    <span className="text-xs font-bold truncate">{proj.name}</span>
                    <span className="text-[10px] text-[#7a706b]">Room: {proj.roomId} • Opened {proj.lastOpened}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDownloadProjectZip(proj.roomId, proj.name)}
                      className="p-1.5 text-[#7a706b] hover:text-[#8b5cf6] transition-colors"
                      title="Download as ZIP"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteProject(proj.roomId, e)}
                      className="p-1.5 text-[#7a706b] hover:text-rose-500 transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/room/${proj.roomId}`)}
                      className="bg-[#8b5cf6] text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm"
                    >
                      Rejoin
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Naming Modal for New Projects */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleConfirmCreateRoom} className="w-full max-w-sm bg-[#faf8f5] border border-[#dfd5c8] rounded-3xl p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm">Name Your Workspace</h3>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#7a706b] font-bold">Project Name</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Portfolio Website, Realtime Chat"
                value={customProjectName}
                onChange={(e) => setCustomProjectName(e.target.value)}
                className="bg-[#f2ece4] border border-[#dfd5c8] rounded-2xl px-4 py-2.5 text-xs outline-none focus:border-[#8b5cf6]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-xs font-bold text-[#7a706b] px-4 py-2 rounded-xl hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm"
              >
                Create Workspace
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};