import mongoose, { Schema, Document } from 'mongoose';

export interface IFileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId?: string | null;
  language?: string;
  content?: string;
  isLocked?: boolean;
}

export interface ICodeSnapshot {
  id: string;
  fileId: string;
  fileName: string;
  name: string;
  content: string;
  author: string;
  timestamp: string;
}

export interface IChatMessage {
  id: string;
  senderId: string;
  username: string;
  message: string;
  color: string;
  timestamp: string;
  readBy: string[];
}

export interface IRoom extends Document {
  roomId: string;
  name: string;
  ownerEmail?: string;
  isReadOnly: boolean;
  nodes: IFileTreeNode[];
  snapshots: ICodeSnapshot[];
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema: Schema = new Schema(
  {
    roomId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    ownerEmail: { type: String },
    isReadOnly: { type: Boolean, default: false },
    nodes: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ['file', 'folder'], required: true },
        parentId: { type: String, default: null },
        language: { type: String },
        content: { type: String, default: '' },
        isLocked: { type: Boolean, default: false },
      },
    ],
    snapshots: [
      {
        id: { type: String },
        fileId: { type: String },
        fileName: { type: String },
        name: { type: String },
        content: { type: String },
        author: { type: String },
        timestamp: { type: String },
      },
    ],
    messages: [
      {
        id: { type: String },
        senderId: { type: String },
        username: { type: String },
        message: { type: String },
        color: { type: String },
        timestamp: { type: String },
        readBy: [{ type: String }],
      },
    ],
  },
  { timestamps: true }
);

export const Room = mongoose.model<IRoom>('Room', RoomSchema);