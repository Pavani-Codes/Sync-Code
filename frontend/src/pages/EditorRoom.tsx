import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import { io, Socket } from 'socket.io-client';
import {
  CodeXml,
  LogOut,
  Users,
  Copy,
  Check,
  Play,
  Terminal,
  Loader2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MessageSquare,
  Send,
  X,
  Trash2,
  Smile,
  FileCode,
  FilePlus,
  FolderPlus,
  Folder,
  FolderOpen,
  Palette,
  Settings,
  Lock,
  Unlock,
  Shield,
  ShieldAlert,
  UserX,
  History,
  BookmarkPlus,
  RotateCcw,
  Eye,
  UserCheck,
} from 'lucide-react';

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId?: string | null;
  language?: string;
  content?: string;
  isLocked?: boolean;
}

export interface CodeSnapshot {
  id: string;
  fileId: string;
  fileName: string;
  name: string;
  content: string;
  author: string;
  timestamp: string;
}

const LANGUAGE_BOILERPLATES: Record<string, string> = {
  python: `# Python Starter Template\ndef main():\n    print("Hello from SyncCode in Python!")\n\nif __name__ == "__main__":\n    main()\n`,
  java: `// Java Starter Template\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from SyncCode in Java!");\n    }\n}\n`,
  cpp: `// C++ Starter Template\n#include <iostream>\n\nint main() {\n    std::cout << "Hello from SyncCode in C++!" << std::endl;\n    return 0;\n}\n`,
};

const inferLanguage = (fileName: string, explicitLang?: string): string => {
  if (explicitLang && ['python', 'java', 'cpp'].includes(explicitLang.toLowerCase())) {
    return explicitLang.toLowerCase();
  }
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['py'].includes(ext)) return 'python';
  if (['java'].includes(ext)) return 'java';
  if (['cpp', 'cc', 'cxx', 'h', 'hpp'].includes(ext)) return 'cpp';
  return 'python';
};

const THEMES = {
  defaultDark: {
    name: 'Default VS Dark',
    bg: 'bg-[#1e1e1e]',
    panelBg: 'bg-[#252526]',
    text: 'text-[#d4d4d4]',
    textMuted: 'text-[#858585]',
    border: 'border-[#333333]',
    activeItem: 'bg-[#37373d] text-[#ffffff] border-[#007acc]',
    accentBg: 'bg-[#007acc] hover:bg-[#0062a3]',
    accentText: 'text-[#3794ff]',
    monacoTheme: 'vs-dark',
    chatBubbleSelf: 'bg-[#007acc] text-white',
    chatBubbleOther: 'bg-[#2d2d2d] text-[#d4d4d4] border border-[#3e3e3e]',
  },
  light: {
    name: 'Pinterest Light',
    bg: 'bg-[#faf8f5]',
    panelBg: 'bg-[#f2ece4]',
    text: 'text-[#2d2825]',
    textMuted: 'text-[#7a706b]',
    border: 'border-[#dfd5c8]',
    activeItem: 'bg-[#e5dbc9] text-[#2d2825] border-[#cbb89f] font-bold',
    accentBg: 'bg-[#d96b52] hover:bg-[#c4573e]',
    accentText: 'text-[#d96b52]',
    monacoTheme: 'pastel-sand',
    chatBubbleSelf: 'bg-[#d96b52] text-white',
    chatBubbleOther: 'bg-[#e7ded2] text-[#2d2825] border border-[#d5c7b5]',
  },
  lavenderCream: {
    name: 'Lavender Cream',
    bg: 'bg-[#f7f5fd]',
    panelBg: 'bg-[#eee9fa]',
    text: 'text-[#2b2538]',
    textMuted: 'text-[#7d7194]',
    border: 'border-[#d8ccf1]',
    activeItem: 'bg-[#dfd3f7] text-[#2b2538] border-[#aa91db] font-bold',
    accentBg: 'bg-[#8b5cf6] hover:bg-[#7c3aed]',
    accentText: 'text-[#8b5cf6]',
    monacoTheme: 'pastel-lavender-light',
    chatBubbleSelf: 'bg-[#8b5cf6] text-white',
    chatBubbleOther: 'bg-[#e4daf7] text-[#2b2538] border border-[#cfc1ee]',
  },
  matchaMilk: {
    name: 'Matcha Milk',
    bg: 'bg-[#f5f8f5]',
    panelBg: 'bg-[#e7efe8]',
    text: 'text-[#212e24]',
    textMuted: 'text-[#68826f]',
    border: 'border-[#c8dcd0]',
    activeItem: 'bg-[#d0e4d6] text-[#212e24] border-[#92bd9e] font-bold',
    accentBg: 'bg-[#52a468] hover:bg-[#438a56]',
    accentText: 'text-[#52a468]',
    monacoTheme: 'pastel-matcha-light',
    chatBubbleSelf: 'bg-[#52a468] text-white',
    chatBubbleOther: 'bg-[#dcecd0] text-[#212e24] border border-[#bfd8ca]',
  },
};

type ThemeKey = keyof typeof THEMES;
const QUICK_EMOJIS = ['👍', '🔥', '🚀', '❤️', '😂', '🎉', '💯', '👀'];

interface RoomUser {
  socketId: string;
  username: string;
  color: string;
  isHost: boolean;
  activeFileId?: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  username: string;
  message: string;
  color: string;
  timestamp: string;
  readBy: string[];
}

interface RemoteCursorData {
  socketId: string;
  fileId: string;
  cursor: { lineNumber: number; column: number };
  username: string;
  color: string;
}

const handleEditorWillMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('pastel-sand', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '9c8f85', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c25038', fontStyle: 'bold' },
      { token: 'string', foreground: '3e7a56' },
      { token: 'number', foreground: '2d6da3' },
      { token: 'function', foreground: '875323' },
    ],
    colors: {
      'editor.background': '#faf8f5',
      'editor.foreground': '#2d2825',
      'editorCursor.foreground': '#d96b52',
      'editor.lineHighlightBackground': '#f0e8dc',
      'editorLineNumber.foreground': '#bfb2a3',
      'editorLineNumber.activeForeground': '#d96b52',
      'editorGutter.background': '#faf8f5',
    },
  });

  monaco.editor.defineTheme('pastel-lavender-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '988cb3', fontStyle: 'italic' },
      { token: 'keyword', foreground: '7c3aed', fontStyle: 'bold' },
      { token: 'string', foreground: '2b8a6e' },
      { token: 'number', foreground: 'c04b86' },
      { token: 'function', foreground: '5b5bd6' },
    ],
    colors: {
      'editor.background': '#f7f5fd',
      'editor.foreground': '#2b2538',
      'editorCursor.foreground': '#8b5cf6',
      'editor.lineHighlightBackground': '#ece5f9',
      'editorLineNumber.foreground': '#bfaeeb',
      'editorLineNumber.activeForeground': '#8b5cf6',
      'editorGutter.background': '#f7f5fd',
    },
  });

  monaco.editor.defineTheme('pastel-matcha-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '819e88', fontStyle: 'italic' },
      { token: 'keyword', foreground: '3a824e', fontStyle: 'bold' },
      { token: 'string', foreground: 'b87333' },
      { token: 'number', foreground: '2b7185' },
      { token: 'function', foreground: '487330' },
    ],
    colors: {
      'editor.background': '#f5f8f5',
      'editor.foreground': '#212e24',
      'editorCursor.foreground': '#52a468',
      'editor.lineHighlightBackground': '#e3efe6',
      'editorLineNumber.foreground': '#a8c7b1',
      'editorLineNumber.activeForeground': '#52a468',
      'editorGutter.background': '#f5f8f5',
    },
  });
};

export const EditorRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // Unique user identification per browser session/tab
  const [username] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const baseName = user.name || user.username;
      if (baseName) {
        const sessionSuffix = Math.floor(100 + Math.random() * 900);
        return `${baseName}_${sessionSuffix}`;
      }
    } catch {}
    return `Developer_${Math.floor(1000 + Math.random() * 9000)}`;
  });

  const currentUserRef = useRef({ name: username });

  // UI States
  const [currentThemeKey, setCurrentThemeKey] = useState<ThemeKey>(() => {
    const saved = localStorage.getItem('syncCode_theme') as ThemeKey;
    return saved && THEMES[saved] ? saved : 'light';
  });
  const [fontSize, setFontSize] = useState(14);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const theme = THEMES[currentThemeKey];

  const handleThemeChange = (newTheme: ThemeKey) => {
    setCurrentThemeKey(newTheme);
    localStorage.setItem('syncCode_theme', newTheme);
    setIsThemeModalOpen(false);
  };

  // Editor States
  const [nodes, setNodes] = useState<FileTreeNode[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>('');
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({ 'folder-src': true });
  const [followingSocketId, setFollowingSocketId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [checkpointName, setCheckpointName] = useState('');
  const [isCreatingCheckpoint, setIsCreatingCheckpoint] = useState(false);

  // Security & Users
  const [roomPermissions, setRoomPermissions] = useState<{ isReadOnly: boolean; hostSocketId: string | null }>({
    isReadOnly: false,
    hostSocketId: null,
  });
  const [createModal, setCreateModal] = useState<{ type: 'file' | 'folder'; parentId: string | null } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeUsers, setActiveUsers] = useState<RoomUser[]>([]);

  // Execution & Chat
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Synchronization Lock to prevent remote overwrite and cursor collision
  const isRemoteUpdate = useRef(false);

  // References
  const socketRef = useRef<Socket | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const remoteCursorPositions = useRef<Map<string, RemoteCursorData>>(new Map());
  const remoteCursorElements = useRef<Map<string, HTMLDivElement>>(new Map());

  const activeFileIdRef = useRef(activeFileId);
  useEffect(() => {
    activeFileIdRef.current = activeFileId;
  }, [activeFileId]);

  const isHost = roomPermissions.hostSocketId === socketRef.current?.id;
  const activeFile = nodes.find((n) => n.id === activeFileId && n.type === 'file');
  const isEditorLocked = !isHost && (roomPermissions.isReadOnly || activeFile?.isLocked);

  const handleLanguageChange = (newLang: string) => {
    if (!activeFileId || !activeFile) return;

    const hasOnlyComment =
      !activeFile.content ||
      activeFile.content.trim().startsWith('//') ||
      activeFile.content.trim().startsWith('#') ||
      activeFile.content.includes('<!DOCTYPE html>') ||
      activeFile.content.includes('<html>');

    const newContent = hasOnlyComment
      ? (LANGUAGE_BOILERPLATES[newLang] || '')
      : activeFile.content;

    setNodes((prev) =>
      prev.map((n) => (n.id === activeFileId ? { ...n, language: newLang, content: newContent } : n))
    );

    socketRef.current?.emit('file-code-change', {
      roomId,
      fileId: activeFileId,
      content: newContent,
      language: newLang,
    });
  };

  const renderAllOverlayCursors = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !overlayRef.current) return;

    remoteCursorPositions.current.forEach((data, socketId) => {
      let cursorEl = remoteCursorElements.current.get(socketId);

      if (data.fileId !== activeFileIdRef.current) {
        if (cursorEl) cursorEl.style.display = 'none';
        return;
      }

      if (!cursorEl) {
        cursorEl = document.createElement('div');
        cursorEl.className = 'absolute pointer-events-none z-50';

        cursorEl.innerHTML = `
          <div class="relative">
            <div class="cursor-label absolute bottom-full left-0 mb-1 text-[10px] font-bold text-white px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap pointer-events-none z-50 tracking-wide" style="background-color: ${data.color}">
              ${data.username}
            </div>
            <div class="cursor-line w-[2px] h-[18px] rounded-full pointer-events-none" style="background-color: ${data.color}"></div>
          </div>
        `;

        overlayRef.current?.appendChild(cursorEl);
        remoteCursorElements.current.set(socketId, cursorEl);
      }

      const visiblePos = editor.getScrolledVisiblePosition({
        lineNumber: data.cursor.lineNumber,
        column: data.cursor.column,
      });

      if (visiblePos) {
        cursorEl.style.display = 'block';
        cursorEl.style.transform = `translate(${visiblePos.left}px, ${visiblePos.top}px)`;
      } else {
        cursorEl.style.display = 'none';
      }
    });
  }, []);

  const removeRemoteCursor = useCallback((socketId: string) => {
    const el = remoteCursorElements.current.get(socketId);
    if (el) {
      el.remove();
      remoteCursorElements.current.delete(socketId);
    }
    remoteCursorPositions.current.delete(socketId);
  }, []);

  const handleSelectFile = (fileId: string) => {
    setActiveFileId(fileId);
    socketRef.current?.emit('peer:active-file-change', { roomId, fileId });
  };

  useEffect(() => {
    renderAllOverlayCursors();
  }, [activeFileId, renderAllOverlayCursors]);

  // SOCKET CONNECTION & INITIALIZATION
  useEffect(() => {
    const BACKEND_URL =
      import.meta.env.VITE_BACKEND_URL || 'https://synccode-backend-9s50.onrender.com';

    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', {
        roomId,
        username: currentUserRef.current.name,
      });
    });

    socket.on('active-users-update', (users: RoomUser[]) => {
      setActiveUsers(users);
    });

    socket.on('room-permissions-update', (permissions) => {
      setRoomPermissions(permissions);
    });

    socket.on('snapshots-update', (updatedSnapshots: CodeSnapshot[]) => {
      setSnapshots(updatedSnapshots);
    });

    socket.on('kicked-from-room', () => {
      alert('You have been removed from the room by the host.');
      navigate('/dashboard');
    });

    socket.on('files-update', (projectNodes: FileTreeNode[]) => {
      const normalizedNodes = projectNodes.map((n) => {
        if (n.type === 'file') {
          const isLegacyHtml =
            n.name.toLowerCase().endsWith('.html') ||
            n.name.toLowerCase().endsWith('.htm') ||
            n.name.toLowerCase() === 'index.html' ||
            (n.content && (n.content.includes('<!DOCTYPE html>') || n.content.includes('<html>')));

          const finalName = isLegacyHtml ? 'main.py' : n.name;
          const resolvedLang = isLegacyHtml ? 'python' : inferLanguage(finalName, n.language);

          return {
            ...n,
            name: finalName,
            language: resolvedLang,
            content: isLegacyHtml || !n.content ? LANGUAGE_BOILERPLATES[resolvedLang] : n.content,
          };
        }
        return n;
      });

      setNodes(normalizedNodes);

      setActiveFileId((currentActive) => {
        const fileExists = normalizedNodes.some((n) => n.id === currentActive && n.type === 'file');
        if (!fileExists) {
          const firstFile = normalizedNodes.find((n) => n.type === 'file');
          return firstFile ? firstFile.id : currentActive;
        }
        return currentActive;
      });
    });

    // Cursor-preserving remote edit update
    socket.on('file-code-update', ({ fileId, content }: { fileId: string; content: string }) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === fileId ? { ...n, content } : n))
      );

      if (fileId === activeFileIdRef.current && editorRef.current) {
        const editor = editorRef.current;
        const model = editor.getModel();

        if (model && model.getValue() !== content) {
          isRemoteUpdate.current = true;
          const currentPosition = editor.getPosition();

          editor.executeEdits('remote-sync', [
            {
              range: model.getFullModelRange(),
              text: content,
              forceMoveMarkers: true,
            },
          ]);

          editor.pushUndoStop();

          if (currentPosition) {
            editor.setPosition(currentPosition);
          }

          isRemoteUpdate.current = false;
        }
      }

      setTimeout(() => renderAllOverlayCursors(), 0);
    });

    socket.on('peer:active-file-changed', ({ socketId, fileId }: { socketId: string; fileId: string }) => {
      setFollowingSocketId((currentFollowing) => {
        if (currentFollowing === socketId) {
          setActiveFileId(fileId);
        }
        return currentFollowing;
      });
    });

    socket.on('execution-output', (resultOutput: string) => {
      setOutput(resultOutput);
      setIsConsoleOpen(true);
    });

    socket.on('remote-cursor-update', (data: RemoteCursorData) => {
      remoteCursorPositions.current.set(data.socketId, data);
      renderAllOverlayCursors();
    });

    socket.on('remote-cursor-remove', (socketId: string) => {
      removeRemoteCursor(socketId);
    });

    socket.on('receive-message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      setUnreadCount((prev) => {
        const chatOpenState = document.getElementById('chat-panel');
        return chatOpenState ? prev : prev + 1;
      });
    });

    socket.on('message-deleted', (messageId: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    socket.on('message-read-update', ({ messageId, username }: { messageId: string; username: string }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId && !msg.readBy.includes(username)) {
            return { ...msg, readBy: [...msg.readBy, username] };
          }
          return msg;
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, navigate, removeRemoteCursor, renderAllOverlayCursors]);

  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });

      const unreadMessages = messages.filter(
        (msg) => msg.senderId !== socketRef.current?.id && !msg.readBy.includes(currentUserRef.current.name)
      );

      unreadMessages.forEach((msg) => {
        socketRef.current?.emit('mark-read', {
          roomId,
          messageId: msg.id,
          username: currentUserRef.current.name,
        });
      });
    }
  }, [isChatOpen, messages, roomId]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.onDidChangeCursorPosition((e) => {
      if (!editor.hasTextFocus()) return;

      socketRef.current?.emit('cursor-change', {
        roomId,
        fileId: activeFileIdRef.current,
        cursor: { lineNumber: e.position.lineNumber, column: e.position.column },
        username: currentUserRef.current.name,
      });
    });

    editor.onDidBlurEditorWidget(() => {
      socketRef.current?.emit('cursor-blur', { roomId });
    });

    editor.onDidScrollChange(() => renderAllOverlayCursors());
    editor.onDidLayoutChange(() => renderAllOverlayCursors());
    editor.onDidChangeModelContent(() => renderAllOverlayCursors());

    window.addEventListener('resize', renderAllOverlayCursors);
  };

  const handleCodeChange = (value: string | undefined) => {
    if (isEditorLocked || isRemoteUpdate.current) return;

    const updatedContent = value || '';

    setNodes((prev) =>
      prev.map((n) => (n.id === activeFileId ? { ...n, content: updatedContent } : n))
    );

    socketRef.current?.emit('file-code-change', {
      roomId,
      fileId: activeFileId,
      content: updatedContent,
    });
  };

  const toggleFolder = (folderId: string) => {
    setOpenFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkpointName.trim() || !activeFile) return;

    const newSnapshot: CodeSnapshot = {
      id: `snap-${Date.now()}`,
      fileId: activeFile.id,
      fileName: activeFile.name,
      name: checkpointName.trim(),
      content: activeFile.content || '',
      author: currentUserRef.current.name,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    socketRef.current?.emit('create-snapshot', { roomId, snapshot: newSnapshot });
    setCheckpointName('');
    setIsCreatingCheckpoint(false);
  };

  const handleRestoreSnapshot = (snapshot: CodeSnapshot) => {
    if (isEditorLocked) return;
    socketRef.current?.emit('restore-snapshot', {
      roomId,
      fileId: snapshot.fileId,
      content: snapshot.content,
    });
  };

  const handleToggleReadOnly = () => {
    socketRef.current?.emit('toggle-read-only', {
      roomId,
      isReadOnly: !roomPermissions.isReadOnly,
    });
  };

  const handleToggleLockFile = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    socketRef.current?.emit('toggle-lock-file', { roomId, fileId });
  };

  const handleKickUser = (targetSocketId: string) => {
    socketRef.current?.emit('kick-user', { roomId, targetSocketId });
  };

  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !createModal) return;

    const lang = inferLanguage(newItemName.trim());
    const defaultContent = LANGUAGE_BOILERPLATES[lang] || `// ${newItemName.trim()}\n`;

    const newNode: FileTreeNode = {
      id: `${createModal.type}-${Date.now()}`,
      name: newItemName.trim(),
      type: createModal.type,
      parentId: createModal.parentId,
      language: createModal.type === 'file' ? lang : undefined,
      content: createModal.type === 'file' ? defaultContent : undefined,
      isLocked: false,
    };

    setNodes((prev) => [...prev, newNode]);
    socketRef.current?.emit('create-node', { roomId, node: newNode });

    if (createModal.parentId) {
      setOpenFolders((prev) => ({ ...prev, [createModal.parentId!]: true }));
    }

    setNewItemName('');
    setCreateModal(null);
  };

  const handleDeleteNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    socketRef.current?.emit('delete-node', { roomId, nodeId });
  };

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const runCode = async () => {
    if (!activeFile) return;

    setIsRunning(true);
    setIsConsoleOpen(true);
    setOutput(`Executing ${activeFile.name}...`);

    const BACKEND_URL =
      import.meta.env.VITE_BACKEND_URL || 'https://synccode-backend-9s50.onrender.com';

    try {
      const response = await fetch(`${BACKEND_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: activeFile.language, code: activeFile.content }),
      });

      const data = await response.json();
      setOutput(data.output || data.error || 'Execution completed.');
      socketRef.current?.emit('run-code-results', { roomId, output: data.output });
    } catch (err: any) {
      const errorMsg = `Error: Execution failed. ${err.message}`;
      setOutput(errorMsg);
      socketRef.current?.emit('run-code-results', { roomId, output: errorMsg });
    } finally {
      setIsRunning(false);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const myUser = activeUsers.find((u) => u.socketId === socketRef.current?.id);
    const userColor = myUser?.color || '#8b5cf6';
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    socketRef.current?.emit('send-message', {
      roomId,
      id: `${Date.now()}-${Math.random()}`,
      message: newMessage,
      username: currentUserRef.current.name,
      color: userColor,
      timestamp,
    });

    setNewMessage('');
    setShowEmojiPicker(false);
  };

  const deleteMessage = (messageId: string) => {
    socketRef.current?.emit('delete-message', { roomId, messageId });
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
    if (isHistoryOpen) setIsHistoryOpen(false);
  };

  const toggleHistory = () => {
    setIsHistoryOpen(!isHistoryOpen);
    if (isChatOpen) setIsChatOpen(false);
  };

  const sortedActiveUsers = [...activeUsers].sort((a, b) => {
    if (a.socketId === socketRef.current?.id) return -1;
    if (b.socketId === socketRef.current?.id) return 1;
    return 0;
  });

  const renderTree = (parentId: string | null = null, depth = 0) => {
    const children = nodes.filter((n) => n.parentId === parentId);

    return children.map((node) => {
      const isFolder = node.type === 'folder';
      const isOpen = openFolders[node.id];
      const isActive = node.id === activeFileId;

      return (
        <div key={node.id} className="select-none">
          <div
            onClick={() => {
              if (isFolder) toggleFolder(node.id);
              else handleSelectFile(node.id);
            }}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            className={`group flex items-center justify-between py-1.5 px-2.5 rounded-xl text-xs cursor-pointer transition-all duration-150 ${
              isActive && !isFolder
                ? `${theme.activeItem} shadow-sm`
                : `${theme.textMuted} hover:${theme.text} hover:bg-black/5`
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {isFolder ? (
                <>
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                  )}
                  {isOpen ? (
                    <FolderOpen className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Folder className="h-4 w-4 text-amber-500" />
                  )}
                </>
              ) : (
                <FileCode className={`h-4 w-4 ml-3.5 ${isActive ? theme.accentText : 'opacity-70'}`} />
              )}
              <span className="truncate font-medium">{node.name}</span>
              {node.isLocked && (
                <span title="Locked by Host">
                  <Lock className="h-3 w-3 text-amber-500 ml-1" />
                </span>
              )}
            </div>

            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
              {!isFolder && isHost && (
                <button
                  onClick={(e) => handleToggleLockFile(node.id, e)}
                  className="p-0.5 hover:text-amber-500"
                  title={node.isLocked ? 'Unlock File' : 'Lock File'}
                >
                  {node.isLocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                </button>
              )}
              {isFolder && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreateModal({ type: 'file', parentId: node.id });
                    }}
                    className="p-0.5 hover:text-indigo-500"
                    title="New File"
                  >
                    <FilePlus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreateModal({ type: 'folder', parentId: node.id });
                    }}
                    className="p-0.5 hover:text-amber-500"
                    title="New Subfolder"
                  >
                    <FolderPlus className="h-3 w-3" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => handleDeleteNode(node.id, e)}
                className="p-0.5 hover:text-rose-500"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          {isFolder && isOpen && renderTree(node.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className={`h-screen flex flex-col ${theme.bg} ${theme.text} transition-colors duration-300 font-sans overflow-hidden select-none`}>
      {/* Top Navbar */}
      <nav className={`h-14 border-b ${theme.border} ${theme.panelBg} px-6 flex items-center justify-between shadow-sm relative z-30`}>
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <CodeXml className={`h-5 w-5 ${theme.accentText}`} />
          </div>
          <span className="font-extrabold text-lg tracking-wider">SyncCode</span>
          <span className="opacity-30">|</span>

          {/* Room Badge */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-mono border ${theme.border} bg-black/5`}>
            <span className={theme.textMuted}>Room:</span>
            <span className={`font-bold ${theme.accentText}`}>{roomId}</span>
            <button onClick={copyRoomId} className="ml-1 opacity-70 hover:opacity-100 transition-opacity">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          {roomPermissions.isReadOnly && (
            <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-xs px-2.5 py-1 rounded-xl font-bold">
              <ShieldAlert className="h-3.5 w-3.5" /> Room Read-Only
            </span>
          )}
        </div>

        {/* Navbar Controls */}
        <div className="flex items-center gap-3">
          {isHost && (
            <button
              onClick={handleToggleReadOnly}
              className={`flex items-center gap-1.5 border ${
                roomPermissions.isReadOnly
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                  : 'border-slate-300 text-slate-700'
              } px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 shadow-sm`}
            >
              <Shield className="h-3.5 w-3.5" />
              {roomPermissions.isReadOnly ? 'Unlock Room' : 'Lock Room (Read-Only)'}
            </button>
          )}

          <button
            onClick={toggleHistory}
            className={`flex items-center gap-1.5 border ${theme.border} ${theme.panelBg} ${theme.text} px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 shadow-sm`}
          >
            <History className={`h-3.5 w-3.5 ${theme.accentText}`} />
            History
          </button>

          <button
            onClick={() => setIsThemeModalOpen(true)}
            className={`flex items-center gap-1.5 border ${theme.border} ${theme.panelBg} ${theme.text} px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 shadow-sm`}
          >
            <Palette className={`h-3.5 w-3.5 ${theme.accentText}`} />
            Theme
          </button>

          <button
            onClick={runCode}
            disabled={isRunning || !activeFile}
            className={`flex items-center gap-2 ${theme.accentBg} text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-50`}
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            {isRunning ? 'Executing...' : `Run ${activeFile?.name || 'Code'}`}
          </button>

          <button
            onClick={toggleChat}
            className={`relative flex items-center gap-1.5 border ${theme.border} ${theme.panelBg} ${theme.text} px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 shadow-sm`}
          >
            <MessageSquare className={`h-3.5 w-3.5 ${theme.accentText}`} />
            Chat
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
          >
            <LogOut className="h-3.5 w-3.5" />
            Leave
          </button>
        </div>
      </nav>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className={`w-64 border-r ${theme.border} ${theme.panelBg} flex flex-col shadow-sm`}>
          <div className="p-3 border-b border-inherit flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className={`${theme.textMuted} text-[11px] font-extrabold uppercase tracking-widest`}>Explorer</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCreateModal({ type: 'file', parentId: null })}
                  className="p-1 opacity-70 hover:opacity-100 rounded-lg transition-opacity"
                  title="New File"
                >
                  <FilePlus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCreateModal({ type: 'folder', parentId: null })}
                  className="p-1 opacity-70 hover:opacity-100 rounded-lg transition-opacity"
                  title="New Folder"
                >
                  <FolderPlus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {createModal && (
              <form onSubmit={handleCreateNode} className={`mb-3 p-2 bg-black/5 rounded-xl border ${theme.border} flex gap-1`}>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={createModal.type === 'folder' ? 'folder-name' : 'filename.py'}
                  autoFocus
                  className="flex-1 bg-transparent text-xs px-2 py-1 outline-none border-b border-indigo-500 font-mono"
                />
                <button type="submit" className={`${theme.accentBg} text-white px-2 py-1 rounded-lg text-xs font-bold`}>
                  Add
                </button>
                <button type="button" onClick={() => setCreateModal(null)} className="opacity-50 hover:opacity-100 px-1">
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            )}

            <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 font-sans">
              {renderTree(null)}
            </div>
          </div>

          {/* Collaborators & Active Peers Panel */}
          <div className="p-3 h-48 border-t border-inherit flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className={`flex items-center gap-2 ${theme.textMuted} text-[11px] font-extrabold uppercase tracking-widest`}>
                <Users className="h-3.5 w-3.5" />
                Collaborators
              </div>
              <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                {activeUsers.length} online
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {sortedActiveUsers.map((user) => {
                const isSelf = user.socketId === socketRef.current?.id;
                const isUserHost = user.socketId === roomPermissions.hostSocketId;
                const isFollowing = followingSocketId === user.socketId;

                return (
                  <div
                    key={user.socketId}
                    className={`group flex items-center justify-between p-2 rounded-xl border transition-all ${
                      isFollowing ? 'border-indigo-500 bg-indigo-500/10' : `${theme.border} bg-black/5`
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <div
                        style={{ backgroundColor: user.color }}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white shadow-sm flex-shrink-0"
                      >
                        {user.username?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <span className="text-xs font-semibold truncate">
                        {user.username} {isSelf && <span className={`${theme.textMuted} font-normal`}>(you)</span>}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isUserHost && (
                        <span className="text-[9px] bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 px-1.5 py-0.5 rounded-full font-bold">
                          Host
                        </span>
                      )}

                      {!isSelf && (
                        <button
                          onClick={() => setFollowingSocketId(isFollowing ? null : user.socketId)}
                          title={isFollowing ? 'Stop Following' : 'Follow User View'}
                          className={`p-1 rounded-lg transition-all ${
                            isFollowing
                              ? 'bg-indigo-600 text-white'
                              : 'opacity-60 hover:opacity-100 hover:bg-black/10'
                          }`}
                        >
                          {isFollowing ? <UserCheck className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      )}

                      {isHost && !isSelf && (
                        <button
                          onClick={() => handleKickUser(user.socketId)}
                          className="opacity-0 group-hover:opacity-100 text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg transition-all"
                          title="Kick User"
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Editor + Console Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Active File Header */}
          <div className={`h-9 border-b ${theme.border} ${theme.panelBg} px-4 flex items-center justify-between text-xs font-mono`}>
            <div className="flex items-center gap-2">
              <FileCode className={`h-4 w-4 ${theme.accentText}`} />
              <span className="font-bold">{activeFile?.name || 'No Active File'}</span>

              {activeFile && (
                <select
                  value={activeFile.language || 'python'}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="bg-transparent border border-[#dfd5c8] rounded-lg px-2 py-0.5 text-[11px] font-bold outline-none cursor-pointer"
                >
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>
              )}

              {isEditorLocked && (
                <span className="text-amber-600 bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Locked
                </span>
              )}
            </div>

            {/* Save Checkpoint Action */}
            <div className="flex items-center gap-3">
              {activeFile && !isEditorLocked && (
                <button
                  onClick={() => setIsCreatingCheckpoint(!isCreatingCheckpoint)}
                  className={`flex items-center gap-1 text-[11px] font-bold ${theme.accentText} hover:underline`}
                >
                  <BookmarkPlus className="h-3.5 w-3.5" /> Save Checkpoint
                </button>
              )}

              {/* Font Size Selector */}
              <div className={`flex items-center gap-2 ${theme.textMuted} hover:${theme.text} transition-colors`}>
                <Settings className="h-3.5 w-3.5" />
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="bg-transparent text-xs border-none outline-none cursor-pointer font-bold"
                >
                  <option value={12}>12px</option>
                  <option value={14}>14px</option>
                  <option value={16}>16px</option>
                  <option value={18}>18px</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick Create Checkpoint Inline Bar */}
          {isCreatingCheckpoint && (
            <form onSubmit={handleCreateSnapshot} className={`px-4 py-2 border-b ${theme.border} bg-black/5 flex gap-2 items-center`}>
              <span className="text-xs font-bold opacity-70">Checkpoint Name:</span>
              <input
                type="text"
                value={checkpointName}
                onChange={(e) => setCheckpointName(e.target.value)}
                placeholder="e.g. Before refactoring function"
                autoFocus
                className={`flex-1 bg-white/50 border ${theme.border} text-xs rounded-lg px-3 py-1 outline-none`}
              />
              <button type="submit" className={`${theme.accentBg} text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm`}>
                Save
              </button>
              <button type="button" onClick={() => setIsCreatingCheckpoint(false)} className="opacity-50 hover:opacity-100 px-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          )}

          <div className="flex-1 relative overflow-hidden">
            <div
              ref={overlayRef}
              id="cursor-overlay"
              className="absolute inset-0 pointer-events-none z-50 overflow-hidden"
            />
            {activeFile ? (
              <Editor
                height="100%"
                path={activeFile.name}
                theme={theme.monacoTheme}
                language={activeFile.language || 'python'}
                value={activeFile.content}
                onChange={handleCodeChange}
                beforeMount={handleEditorWillMount}
                onMount={handleEditorMount}
                options={{
                  fontSize: fontSize,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  fontFamily: 'Fira Code, JetBrains Mono, monospace',
                  fontLigatures: true,
                  readOnly: isEditorLocked,
                }}
              />
            ) : (
              <div className={`h-full flex flex-col items-center justify-center ${theme.textMuted} text-xs italic`}>
                Select or create a file from the Explorer sidebar to start coding.
              </div>
            )}
          </div>

          {/* Console Window */}
          <div className={`border-t ${theme.border} ${theme.panelBg} transition-all duration-300 ${isConsoleOpen ? 'h-48' : 'h-9'}`}>
            <div
              onClick={() => setIsConsoleOpen(!isConsoleOpen)}
              className="h-9 px-4 flex items-center justify-between cursor-pointer border-b border-inherit select-none"
            >
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Terminal className="h-4 w-4 text-emerald-500" />
                <span>Console Output</span>
              </div>
              <button className="opacity-60 hover:opacity-100">
                {isConsoleOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>

            {isConsoleOpen && (
              <div id="chat-panel" className="p-4 h-[calc(100%-2.25rem)] overflow-auto font-mono text-xs opacity-90 leading-relaxed bg-black/5">
                {output ? (
                  <pre className="whitespace-pre-wrap">{output}</pre>
                ) : (
                  <span className={`${theme.textMuted} italic`}>Click "Run" to execute script and view output here...</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Revision History Drawer */}
        {isHistoryOpen && (
          <div className={`w-80 border-l ${theme.border} ${theme.panelBg} flex flex-col transition-all duration-300 relative shadow-2xl z-20`}>
            <div className={`h-12 border-b ${theme.border} px-4 flex items-center justify-between`}>
              <div className="flex items-center gap-2 font-bold text-xs tracking-wider">
                <History className={`h-4 w-4 ${theme.accentText}`} />
                Revision History
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 font-sans">
              {snapshots.length === 0 ? (
                <div className={`text-center text-xs ${theme.textMuted} my-8 italic`}>
                  No saved checkpoints yet. Click "Save Checkpoint" above to save code snapshots!
                </div>
              ) : (
                snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className={`p-3 rounded-2xl border ${theme.border} bg-black/5 flex flex-col gap-1.5`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold truncate">{snap.name}</span>
                      <span className={`text-[10px] ${theme.textMuted}`}>{snap.timestamp}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] opacity-70 font-mono">
                      <span>📄 {snap.fileName}</span>
                      <span>by {snap.author}</span>
                    </div>

                    <button
                      onClick={() => handleRestoreSnapshot(snap)}
                      disabled={isEditorLocked}
                      className={`mt-1 flex items-center justify-center gap-1.5 ${theme.accentBg} text-white py-1 rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:scale-[1.02]`}
                    >
                      <RotateCcw className="h-3 w-3" /> Restore Checkpoint
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Live Chat Panel */}
        {isChatOpen && (
          <div className={`w-80 border-l ${theme.border} ${theme.panelBg} flex flex-col transition-all duration-300 relative shadow-2xl z-20`}>
            <div className={`h-12 border-b ${theme.border} px-4 flex items-center justify-between`}>
              <div className="flex items-center gap-2 font-bold text-xs tracking-wider">
                <MessageSquare className={`h-4 w-4 ${theme.accentText}`} />
                Room Chat
              </div>
              <button onClick={() => setIsChatOpen(false)} className="opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans">
              {messages.length === 0 ? (
                <div className={`text-center text-xs ${theme.textMuted} my-8 italic`}>
                  No messages yet. Send a message to start chatting!
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isSelf = msg.senderId === socketRef.current?.id;

                  return (
                    <div key={msg.id || idx} className={`group flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold opacity-80">{msg.username}</span>
                        <span className={`text-[9px] ${theme.textMuted}`}>{msg.timestamp}</span>
                      </div>

                      <div className="flex items-center gap-1.5 max-w-[90%]">
                        {isSelf && (
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 text-rose-500 transition-opacity p-1"
                            title="Delete Message"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}

                        <div
                          className={`px-3.5 py-2 rounded-2xl text-xs break-words shadow-sm ${
                            isSelf ? theme.chatBubbleSelf : theme.chatBubbleOther
                          }`}
                        >
                          {msg.message}
                        </div>
                      </div>

                      {isSelf && msg.readBy && msg.readBy.length > 0 && (
                        <span className="text-[9px] text-emerald-600 font-mono mt-0.5 flex items-center gap-0.5 font-bold">
                          ✓✓ Seen by {msg.readBy.join(', ')}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div className={`p-2 border-t ${theme.border} bg-black/5 flex items-center gap-1 justify-between flex-wrap`}>
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setNewMessage((prev) => prev + emoji)}
                    className="p-1.5 text-base hover:bg-black/5 rounded-xl transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Chat Input */}
            <form onSubmit={sendMessage} className={`p-3 border-t ${theme.border} flex gap-2`}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="opacity-60 hover:opacity-100 transition-opacity p-1.5"
                title="Add Emoji"
              >
                <Smile className="h-4 w-4" />
              </button>

              <input
                key="chat-input-box"
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className={`flex-1 bg-black/5 border ${theme.border} ${theme.text} text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500`}
              />

              <button
                type="submit"
                className={`${theme.accentBg} text-white px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center shadow-md`}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Theme Modal */}
      {isThemeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm rounded-3xl border ${theme.border} ${theme.panelBg} ${theme.text} p-6 shadow-2xl flex flex-col gap-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-extrabold text-sm tracking-wide">
                <Palette className={`h-4 w-4 ${theme.accentText}`} />
                Select Theme Palette
              </div>
              <button
                onClick={() => setIsThemeModalOpen(false)}
                className="opacity-60 hover:opacity-100 transition-opacity p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {(Object.keys(THEMES) as ThemeKey[]).map((tKey) => {
                const item = THEMES[tKey];
                const isSelected = currentThemeKey === tKey;

                return (
                  <button
                    key={tKey}
                    onClick={() => handleThemeChange(tKey)}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition-all ${
                      isSelected
                        ? `${item.activeItem} shadow-md`
                        : `${theme.border} opacity-80 hover:opacity-100 hover:bg-black/5`
                    }`}
                  >
                    <span>{item.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};