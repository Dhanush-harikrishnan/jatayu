import { useState, useEffect, useRef, useCallback } from 'react';
import { io as socketIO, Socket } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;

export interface SocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
}

export function useSocket(token?: string) {
  const [state, setState] = useState<SocketState>({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0,
  });
  
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (!token) return;
    if (socketRef.current?.connected) return;

    setState(prev => ({ ...prev, connecting: true, error: null }));

    const socket = socketIO(API_BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false, // We will handle reconnection manually for exponential backoff
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setState({
        connected: true,
        connecting: false,
        error: null,
        reconnectAttempts: 0,
      });
    });

    socket.on('connect_error', (err: any) => {
      setState(prev => {
        const newAttempts = prev.reconnectAttempts + 1;
        const willRetry = err.data?.retry !== false && newAttempts <= MAX_RECONNECT_ATTEMPTS;

        if (willRetry) {
          const delay = RECONNECT_DELAY * Math.pow(2, prev.reconnectAttempts);
          setTimeout(() => {
            if (socketRef.current === socket) {
              socket.connect();
            }
          }, delay);
          
          return {
            ...prev,
            connected: false,
            connecting: true, // true because it will attempt to reconnect
            error: 'Connection error, retrying...',
            reconnectAttempts: newAttempts,
          };
        } else {
          return {
            ...prev,
            connected: false,
            connecting: false,
            error: err.message || 'Max reconnection attempts reached',
            reconnectAttempts: newAttempts,
          };
        }
      });
    });

    socket.on('disconnect', () => {
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
      }));
    });

  }, [token]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setState({
      connected: false,
      connecting: false,
      error: null,
      reconnectAttempts: 0,
    });
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { socket: socketRef.current, state, connect, disconnect };
}
