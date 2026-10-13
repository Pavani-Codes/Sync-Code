import { Request, Response } from 'express';
import { Room } from '../models/Room.model.js';

// Get or Create Room by Room ID
export const getOrCreateRoom = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { name, ownerEmail } = req.body;

    let room = await Room.findOne({ roomId });

    if (!room) {
      // Default boilerplate starter project files if room is brand new
      const defaultNodes = [
        {
          id: 'folder-src',
          name: 'src',
          type: 'folder',
          parentId: null,
        },
        {
          id: 'file-index-js',
          name: 'index.js',
          type: 'file',
          parentId: 'folder-src',
          language: 'javascript',
          content: `// Welcome to SyncCode!\nconsole.log("Hello, World!");\n`,
          isLocked: false,
        },
      ];

      room = new Room({
        roomId,
        name: name || `Project ${roomId}`,
        ownerEmail: ownerEmail || 'dev@synccode.com',
        nodes: defaultNodes,
        snapshots: [],
        messages: [],
      });

      await room.save();
    }

    res.status(200).json(room);
  } catch (error) {
    console.error('Error fetching/creating room:', error);
    res.status(500).json({ message: 'Server error retrieving room data.' });
  }
};

// Get all rooms worked on by user
export const getUserRooms = async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    const rooms = await Room.find(email ? { ownerEmail: email as string } : {})
      .sort({ updatedAt: -1 })
      .limit(10);

    res.status(200).json(rooms);
  } catch (error) {
    console.error('Error fetching user rooms:', error);
    res.status(500).json({ message: 'Failed to fetch user rooms.' });
  }
};

// Delete a room
export const deleteRoom = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    await Room.deleteOne({ roomId });
    res.status(200).json({ message: 'Room deleted successfully.' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ message: 'Failed to delete room.' });
  }
};