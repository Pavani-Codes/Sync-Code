import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { connectDatabase } from './config/db.config.js';
import { envConfig } from './config/env.config.js';
import { Room } from './models/Room.model.js';
import * as Y from 'yjs';
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});
interface RoomUser {
  socketId: string;
  username: string;
  color: string;
  isHost: boolean;
  activeFileId?: string;
}
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
interface RoomPermissions {
  isReadOnly: boolean;
  hostSocketId: string | null;
}
const roomUsers: Record<string, RoomUser[]> = {};
const roomFilesStore: Record<string, FileTreeNode[]> = {};
const yDocsStore = new Map<string, Y.Doc>();

const yDocKey = (roomId: string, fileId: string) => `${roomId}::${fileId}`;

function getYDoc(roomId: string, fileId: string, initialContent?: string): Y.Doc {
  const key = yDocKey(roomId, fileId);
  let doc = yDocsStore.get(key);
  if (!doc) {
    doc = new Y.Doc();
    const file = roomFilesStore[roomId]?.find((node) => node.id === fileId && node.type === 'file');
    const content = typeof initialContent === 'string' ? initialContent : (file?.content ?? '');
    if (content.length > 0) doc.getText('content').insert(0, content);
    yDocsStore.set(key, doc);
  }
  return doc;
}

function persistYjsFile(roomId: string, fileId: string, content: string): void {
  const file = roomFilesStore[roomId]?.find((node) => node.id === fileId && node.type === 'file');
  if (file) file.content = content;
  const debounceKey = `${roomId}_${fileId}`;
  if (debounceTimers[debounceKey]) clearTimeout(debounceTimers[debounceKey]);
  debounceTimers[debounceKey] = setTimeout(async () => {
    try {
      const latestContent = roomFilesStore[roomId]?.find((node) => node.id === fileId && node.type === 'file')?.content ?? content;
      await Room.updateOne(
        { roomId, 'nodes.id': fileId },
        { $set: { 'nodes.$.content': latestContent } }
      );
    } catch (err) {
      console.error('Failed to persist Yjs file content:', err);
    } finally {
      delete debounceTimers[debounceKey];
    }
  }, 1200);
}
const roomPermissionsStore: Record<string, RoomPermissions> = {};
const roomSnapshotsStore: Record<string, CodeSnapshot[]> = {};
const debounceTimers: Record<string, NodeJS.Timeout> = {};
const roomCleanupTimers: Record<string, NodeJS.Timeout> = {};
const DEFAULT_TREE: FileTreeNode[] = [
  {
    id: 'folder-src',
    name: 'src',
    type: 'folder',
    parentId: null,
  },
  {
    id: 'file-1',
    name: 'index.html',
    type: 'file',
    parentId: 'folder-src',
    language: 'html',
    content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>SyncCode App</title>\n</head>\n<body>\n  <h1>Hello from SyncCode!</h1>\n</body>\n</html>',
    isLocked: false,
  },
];
const AVATAR_COLORS = [
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#06b6d4',
  '#a855f7',
  '#ec4899',
];
io.on('connection', (socket) => {
  console.log(`[Socket.io]: Connected -> ${socket.id}`);
  const handleJoinRoom = async ({ roomId, username }: { roomId: string; username: string }) => {
    if (!roomId) return;
    socket.join(roomId);
    if (roomCleanupTimers[roomId]) {
      clearTimeout(roomCleanupTimers[roomId]);
      delete roomCleanupTimers[roomId];
    }
    if (!roomUsers[roomId]) roomUsers[roomId] = [];
    if (!roomPermissionsStore[roomId]) {
      roomPermissionsStore[roomId] = { isReadOnly: false, hostSocketId: socket.id };
    }
    if (!roomFilesStore[roomId]) {
      roomFilesStore[roomId] = JSON.parse(JSON.stringify(DEFAULT_TREE));
    }
    if (!roomSnapshotsStore[roomId]) roomSnapshotsStore[roomId] = [];
    try {
      let dbRoom = await Room.findOne({ roomId });
      if (dbRoom && dbRoom.nodes && dbRoom.nodes.length > 0) {
        roomFilesStore[roomId] = dbRoom.nodes as FileTreeNode[];
        roomSnapshotsStore[roomId] = (dbRoom.snapshots || []) as CodeSnapshot[];
        roomPermissionsStore[roomId].isReadOnly = !!dbRoom.isReadOnly;
      } else if (!dbRoom) {
        dbRoom = new Room({
          roomId,
          name: `Project ${roomId}`,
          ownerEmail: 'dev@synccode.com',
          isReadOnly: false,
          nodes: roomFilesStore[roomId],
          snapshots: [],
          messages: [],
        });
        await dbRoom.save();
      }
    } catch (err) {
      console.error('[MongoDB Warning]: Running in-memory mode:', err);
    }
    const isFirstUser = roomUsers[roomId].length === 0;
    const isHost = isFirstUser || roomPermissionsStore[roomId].hostSocketId === socket.id;
    if (isFirstUser) {
      roomPermissionsStore[roomId].hostSocketId = socket.id;
    }
    const userColor = AVATAR_COLORS[roomUsers[roomId].length % AVATAR_COLORS.length];
    const cleanUsername = username || `Dev_${socket.id.slice(0, 4)}`;
    const newUser: RoomUser = {
      socketId: socket.id,
      username: cleanUsername,
      color: userColor,
      isHost,
      activeFileId: roomFilesStore[roomId][0]?.id || 'file-1',
    };
    // Remove any stale connection for this exact socket ID, then add new user
    roomUsers[roomId] = roomUsers[roomId].filter((u) => u.socketId !== socket.id);
    roomUsers[roomId].push(newUser);
    // Broadcast current states to everyone in the room
    io.to(roomId).emit('active-users-update', roomUsers[roomId]);
    io.to(roomId).emit('room-permissions-update', roomPermissionsStore[roomId]);
    io.to(roomId).emit('files-update', roomFilesStore[roomId]);
    io.to(roomId).emit('snapshots-update', roomSnapshotsStore[roomId]);
  };
  socket.on('join-room', handleJoinRoom);
  socket.on('room:join', handleJoinRoom);

  // Yjs CRDT sync. Each room/file has one server-side Y.Doc; clients exchange
  // binary updates, not stale line/column coordinates or whole-document writes.
  socket.on('yjs-sync-request', ({ roomId, fileId, initialContent }: {
    roomId: string;
    fileId: string;
    initialContent?: string;
  }) => {
    if (!roomId || !fileId || !socket.rooms.has(roomId)) return;
    const file = roomFilesStore[roomId]?.find((node) => node.id === fileId && node.type === 'file');
    if (!file) return;
    const doc = getYDoc(roomId, fileId, initialContent);
    socket.emit('yjs-sync-state', {
      fileId,
      update: Array.from(Y.encodeStateAsUpdate(doc)),
    });
  });

  socket.on('yjs-update', ({ roomId, fileId, update }: {
    roomId: string;
    fileId: string;
    update: number[] | Uint8Array;
  }) => {
    if (!roomId || !fileId || !socket.rooms.has(roomId) || !Array.isArray(update) && !(update instanceof Uint8Array)) return;
    const file = roomFilesStore[roomId]?.find((node) => node.id === fileId && node.type === 'file');
    if (!file) return;
    const doc = getYDoc(roomId, fileId);
    const bytes = update instanceof Uint8Array ? update : new Uint8Array(update);
    try {
      Y.applyUpdate(doc, bytes, socket.id);
      const content = doc.getText('content').toString();
      persistYjsFile(roomId, fileId, content);
      socket.to(roomId).emit('yjs-update', { fileId, update: Array.from(bytes) });
    } catch (error) {
      console.error('[Yjs] Rejected invalid update:', error);
    }
  });

  // Legacy delta events are intentionally not used by the editor anymore. Keep
  // the listener for older clients during deployment compatibility.

  socket.on('file-code-delta', ({ roomId, fileId, range, text }) => {
    socket.to(roomId).emit('file-code-delta', { fileId, range, text });
  });
  socket.on('peer:active-file-change', ({ roomId, fileId }) => {
    if (roomUsers[roomId]) {
      const user = roomUsers[roomId].find((u) => u.socketId === socket.id);
      if (user) {
        user.activeFileId = fileId;
        io.to(roomId).emit('active-users-update', roomUsers[roomId]);
      }
    }
    socket.to(roomId).emit('peer:active-file-changed', { socketId: socket.id, fileId });
  });
  socket.on('file-code-change', async ({ roomId, fileId, content }) => {
    if (typeof content !== 'string' || !roomFilesStore[roomId]) return;
    const file = roomFilesStore[roomId].find((node) => node.id === fileId && node.type === 'file');
    if (!file) return;
    const doc = getYDoc(roomId, fileId, file.content ?? '');
    const text = doc.getText('content');
    doc.transact(() => {
      if (text.length > 0) text.delete(0, text.length);
      if (content.length > 0) text.insert(0, content);
    }, 'legacy-full-replace');
    persistYjsFile(roomId, fileId, text.toString());
    io.to(roomId).emit('yjs-update', {
      fileId,
      update: Array.from(Y.encodeStateAsUpdate(doc)),
    });
  });
  socket.on('create-node', async ({ roomId, node }) => {
    if (!roomFilesStore[roomId]) roomFilesStore[roomId] = [];
    roomFilesStore[roomId].push(node);
    io.to(roomId).emit('files-update', roomFilesStore[roomId]);
    try {
      await Room.updateOne({ roomId }, { $push: { nodes: node } });
    } catch (err) {
      console.error('Failed to persist node creation:', err);
    }
  });
  socket.on('delete-node', async ({ roomId, nodeId }) => {
    if (roomFilesStore[roomId]) {
      const getChildIds = (id: string): string[] => {
        const children = roomFilesStore[roomId].filter((f) => f.parentId === id);
        return [id, ...children.flatMap((c) => getChildIds(c.id))];
      };
      const idsToRemove = getChildIds(nodeId);
      roomFilesStore[roomId] = roomFilesStore[roomId].filter((f) => !idsToRemove.includes(f.id));
      try {
        await Room.updateOne(
          { roomId },
          { $pull: { nodes: { id: {$in: idsToRemove } } } }
        );
      } catch (err) {
        console.error('Failed to persist node deletion:', err);
      }
    }
    io.to(roomId).emit('files-update', roomFilesStore[roomId]);
  });
  socket.on('create-snapshot', async ({ roomId, snapshot }) => {
    if (!roomSnapshotsStore[roomId]) roomSnapshotsStore[roomId] = [];
    roomSnapshotsStore[roomId].unshift(snapshot);
    io.to(roomId).emit('snapshots-update', roomSnapshotsStore[roomId]);
    try {
      await Room.updateOne({ roomId }, { $push: { snapshots: { $each: [snapshot],$position: 0 } } });
    } catch (err) {
      console.error('Failed to persist snapshot:', err);
    }
  });
  socket.on('restore-snapshot', async ({ roomId, fileId, content }) => {
    if (typeof content !== 'string' || !roomFilesStore[roomId]) return;
    const file = roomFilesStore[roomId].find((node) => node.id === fileId && node.type === 'file');
    if (!file) return;
    const doc = getYDoc(roomId, fileId, file.content ?? '');
    const text = doc.getText('content');
    doc.transact(() => {
      if (text.length > 0) text.delete(0, text.length);
      if (content.length > 0) text.insert(0, content);
    }, 'restore-snapshot');
    persistYjsFile(roomId, fileId, text.toString());
    io.to(roomId).emit('yjs-update', {
      fileId,
      update: Array.from(Y.encodeStateAsUpdate(doc)),
    });
    io.to(roomId).emit('files-update', roomFilesStore[roomId]);
  });
  socket.on('toggle-read-only', async ({ roomId, isReadOnly }) => {
    const permissions = roomPermissionsStore[roomId];
    if (permissions && permissions.hostSocketId === socket.id) {
      permissions.isReadOnly = isReadOnly;
      io.to(roomId).emit('room-permissions-update', permissions);
      try {
        await Room.updateOne({ roomId }, { $set: { isReadOnly } });
      } catch (err) {
        console.error('Failed to persist read-only:', err);
      }
    }
  });
  socket.on('toggle-lock-file', async ({ roomId, fileId }) => {
    const permissions = roomPermissionsStore[roomId];
    if (permissions && permissions.hostSocketId === socket.id && roomFilesStore[roomId]) {
      const file = roomFilesStore[roomId].find((f) => f.id === fileId);
      if (file) {
        file.isLocked = !file.isLocked;
        io.to(roomId).emit('files-update', roomFilesStore[roomId]);
        try {
          await Room.updateOne({ roomId, 'nodes.id': fileId }, { $set: { 'nodes.$.isLocked': file.isLocked } });
        } catch (err) {
          console.error('Failed to persist lock:', err);
        }
      }
    }
  });
  socket.on('kick-user', ({ roomId, targetSocketId }) => {
    const permissions = roomPermissionsStore[roomId];
    if (permissions && permissions.hostSocketId === socket.id) {
      io.to(targetSocketId).emit('kicked-from-room');
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      targetSocket?.leave(roomId);
      if (roomUsers[roomId]) {
        roomUsers[roomId] = roomUsers[roomId].filter((u) => u.socketId !== targetSocketId);
        io.to(roomId).emit('active-users-update', roomUsers[roomId]);
      }
    }
  });
  socket.on('run-code-results', ({ roomId, output }) => {
    socket.to(roomId).emit('execution-output', output);
  });
  socket.on('send-message', async ({ roomId, id, message, username, color, timestamp }) => {
    const messageObj = { id, senderId: socket.id, username, message, color, timestamp, readBy: [] };
    io.to(roomId).emit('receive-message', messageObj);
    try {
      await Room.updateOne({ roomId }, { $push: { messages: messageObj } });
    } catch (err) {
      console.error('Failed to persist chat message:', err);
    }
  });
  socket.on('delete-message', async ({ roomId, messageId }) => {
    io.to(roomId).emit('message-deleted', messageId);
    try {
      await Room.updateOne({ roomId }, { $pull: { messages: { id: messageId } } });
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  });
  socket.on('mark-read', ({ roomId, messageId, username }) => {
    socket.to(roomId).emit('message-read-update', { messageId, username });
  });
  socket.on('cursor-change', ({ roomId, fileId, cursor, username }) => {
    const userInRoom = roomUsers[roomId]?.find((u) => u.socketId === socket.id);
    const userColor = userInRoom?.color || '#8b5cf6';
    socket.to(roomId).emit('remote-cursor-update', {
      socketId: socket.id,
      fileId,
      cursor,
      username,
      color: userColor,
    });
  });
  socket.on('cursor-blur', ({ roomId }) => {
    socket.to(roomId).emit('remote-cursor-remove', socket.id);
  });
  socket.on('disconnecting', () => {
    socket.rooms.forEach((roomId) => {
      if (roomUsers[roomId]) {
        socket.to(roomId).emit('remote-cursor-remove', socket.id);
        const isLeavingHost = roomPermissionsStore[roomId]?.hostSocketId === socket.id;
        roomUsers[roomId] = roomUsers[roomId].filter((u) => u.socketId !== socket.id);
        if (isLeavingHost && roomUsers[roomId].length > 0) {
          roomUsers[roomId][0].isHost = true;
          roomPermissionsStore[roomId].hostSocketId = roomUsers[roomId][0].socketId;
          io.to(roomId).emit('room-permissions-update', roomPermissionsStore[roomId]);
        }
        io.to(roomId).emit('active-users-update', roomUsers[roomId]);
        if (roomUsers[roomId].length === 0) {
          roomCleanupTimers[roomId] = setTimeout(() => {
            if (roomUsers[roomId] && roomUsers[roomId].length === 0) {
              delete roomUsers[roomId];
              delete roomFilesStore[roomId];
              delete roomPermissionsStore[roomId];
              delete roomSnapshotsStore[roomId];
              for (const [key, doc] of yDocsStore.entries()) {
                if (key.startsWith(`${roomId}::`)) {
                  doc.destroy();
                  yDocsStore.delete(key);
                }
              }
            }
          }, 15000);
        }
      }
    });
  });
  socket.on('disconnect', () => {
    console.log(`[Socket.io]: Disconnected -> ${socket.id}`);
  });
});
const startServer = async () => {
  try {
    await connectDatabase();
    server.listen(envConfig.port, () => {
      console.log(`[Server]: Server listening on port ${envConfig.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};
startServer();