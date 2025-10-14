import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { mockAuth } from '@/lib/mockAuth';

export type ChatMode = 'ai-assistant' | 'collaboration' | 'support';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  userId?: string;
  username?: string;
}

export interface TypingUser {
  userId: string;
  username: string;
  typing: boolean;
}

interface UseSocketOptions {
  autoConnect?: boolean;
  projectId?: string;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { autoConnect = true, projectId } = options;
  
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [currentMode, setCurrentMode] = useState<ChatMode>('ai-assistant');

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const token = mockAuth.getToken();
    
    socketRef.current = io({
      auth: {
        token: token || undefined,
      },
      autoConnect: false,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected:', socket.id);
      setIsConnected(true);
      
      if (projectId) {
        socket.emit('join:project', projectId);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected');
      setIsConnected(false);
    });

    socket.on('chat:message', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('typing:user', (typingUser: TypingUser) => {
      setTypingUsers((prev) => {
        const filtered = prev.filter((u) => u.userId !== typingUser.userId);
        if (typingUser.typing) {
          return [...filtered, typingUser];
        }
        return filtered;
      });
    });

    socket.on('error', (error: { message: string }) => {
      console.error('[Socket.IO] Error:', error.message);
    });

    socket.connect();
  }, [projectId]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      if (projectId) {
        socketRef.current.emit('leave:project', projectId);
      }
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, [projectId]);

  const joinProject = useCallback((newProjectId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:project', newProjectId);
    }
  }, []);

  const leaveProject = useCallback((oldProjectId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave:project', oldProjectId);
    }
  }, []);

  const sendMessage = useCallback((content: string, mode: ChatMode = currentMode) => {
    if (!socketRef.current?.connected) {
      console.error('[Socket.IO] Cannot send message: not connected');
      return;
    }

    const eventMap: Record<ChatMode, string> = {
      'ai-assistant': 'chat:ai-assistant',
      'collaboration': 'chat:collaboration',
      'support': 'chat:support',
    };

    const event = eventMap[mode];
    
    if (mode === 'ai-assistant') {
      socketRef.current.emit(event, {
        projectId,
        message: content,
      });
    } else if (mode === 'collaboration') {
      if (!projectId) {
        console.error('[Socket.IO] Collaboration mode requires a projectId');
        return;
      }
      socketRef.current.emit(event, {
        projectId,
        message: content,
      });
    } else if (mode === 'support') {
      socketRef.current.emit(event, {
        message: content,
      });
    }
  }, [currentMode, projectId]);

  const startTyping = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing:start', { projectId });
    }
  }, [projectId]);

  const stopTyping = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing:stop', { projectId });
    }
  }, [projectId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const changeMode = useCallback((mode: ChatMode) => {
    setCurrentMode(mode);
    clearMessages();
  }, [clearMessages]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    messages,
    typingUsers,
    currentMode,
    connect,
    disconnect,
    joinProject,
    leaveProject,
    sendMessage,
    startTyping,
    stopTyping,
    clearMessages,
    changeMode,
  };
}
