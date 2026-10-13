import React from 'react';
import { Eye, UserCheck } from 'lucide-react';

export interface Peer {
  socketId: string;
  username: string;
  color: string;
  isHost?: boolean;
  activeFileId?: string;
}

interface ActivePeersPanelProps {
  peers: Peer[];
  followingSocketId: string | null;
  onFollowUser: (socketId: string | null) => void;
  currentSocketId?: string;
  hostSocketId?: string | null;
  onKickUser?: (socketId: string) => void;
  isHost?: boolean;
  theme: any;
}

export const ActivePeersPanel: React.FC<ActivePeersPanelProps> = ({
  peers,
  followingSocketId,
  onFollowUser,
  currentSocketId,
  hostSocketId,
  theme,
}) => {
  return (
    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
      {peers.map((user) => {
        const isSelf = user.socketId === currentSocketId;
        const isUserHost = user.socketId === hostSocketId;
        const isFollowing = followingSocketId === user.socketId;

        return (
          <div
            key={user.socketId}
            className={`group flex items-center justify-between p-2 rounded-xl border ${
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
                  onClick={() => onFollowUser(isFollowing ? null : user.socketId)}
                  title={isFollowing ? 'Stop Following' : 'Follow User View'}
                  className={`p-1 rounded-lg transition-all ${
                    isFollowing
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-black/10'
                  }`}
                >
                  {isFollowing ? <UserCheck className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};