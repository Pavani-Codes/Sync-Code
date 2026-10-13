import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { connectDatabase } from './config/db.config.js';
import { envConfig } from './config/env.config.js';
import { Room } from './models/Room.model.js';

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
    
    Array.from(socket.rooms).forEach((r) => {
      if (r !== socket.id) socket.leave(r);
    });

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
    const cleanUsername = username || 'Anonymous';
    const newUser: RoomUser = { socketId: socket.id, username: cleanUsername, color: userColor, isHost, activeFileId: roomFilesStore[roomId][0]?.id || 'file-1' };

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
    if (roomFilesStore[roomId]) {
      const file = roomFilesStore[roomId].find((f) => f.id === fileId);
      if (file) {
        file.content = content;
      }
    }
    socket.to(roomId).emit('file-code-update', { fileId, content, senderId: socket.id });

    const debounceKey = `${roomId}_${fileId}`;
    if (debounceTimers[debounceKey]) clearTimeout(debounceTimers[debounceKey]);

    debounceTimers[debounceKey] = setTimeout(async () => {
      try {
        await Room.updateOne(
          { roomId, 'nodes.id': fileId },
          { $set: { 'nodes.$.content': content } }
        );
        delete debounceTimers[debounceKey];
      } catch (err) {
        console.error('Failed to persist file code change:', err);
      }
    }, 2000);
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
    if (roomFilesStore[roomId]) {
      const file = roomFilesStore[roomId].find((f) => f.id === fileId);
      if (file) {
        file.content = content;
        io.to(roomId).emit('file-code-update', { fileId, content, senderId: socket.id });
        io.to(roomId).emit('files-update', roomFilesStore[roomId]);
        try {
          await Room.updateOne({ roomId, 'nodes.id': fileId }, { $set: { 'nodes.$.content': content } });
        } catch (err) {
          console.error('Failed to persist restore snapshot:', err);
        }
      }
    }
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