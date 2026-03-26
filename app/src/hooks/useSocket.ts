import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebSocketMessage, SocketState } from '@/types';

const WS_URL = 'wss://api.secureguard.pro';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;
const HEARTBEAT_INTERVAL = 30000;

export function useSocket() {
  const [state, setState] = useState<SocketState>({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0,
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageHandlersRef = useRef<Map<string, ((payload: any) => void)[]>>(new Map());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setState(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setState({
          connected: true,
          connecting: false,
          error: null,
          reconnectAttempts: 0,
        });
        
        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          sendMessage({ type: 'heartbeat', payload: {}, timestamp: new Date() });
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = () => {
        setState(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          error: 'WebSocket connection error',
        }));
      };

      ws.onclose = () => {
        setState(prev => ({
          ...prev,
          connected: false,
          connecting: false,
        }));
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt reconnection
        setState(prev => {
          const newAttempts = prev.reconnectAttempts + 1;
          if (newAttempts <= MAX_RECONNECT_ATTEMPTS) {
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, RECONNECT_DELAY * newAttempts);
            return { ...prev, reconnectAttempts: newAttempts };
          }
          return { ...prev, error: 'Max reconnection attempts reached' };
        });
      };
    } catch (err) {
      setState(prev => ({
        ...prev,
        connecting: false,
        error: 'Failed to create WebSocket connection',
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState({
      connected: false,
      connecting: false,
      error: null,
      reconnectAttempts: 0,
    });
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    const handlers = messageHandlersRef.current.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message.payload));
    }
  }, []);

  const on = useCallback((type: string, handler: (payload: any) => void) => {
    const handlers = messageHandlersRef.current.get(type) || [];
    handlers.push(handler);
    messageHandlersRef.current.set(type, handlers);

    // Return unsubscribe function
    return () => {
      const currentHandlers = messageHandlersRef.current.get(type) || [];
      messageHandlersRef.current.set(
        type,
        currentHandlers.filter(h => h !== handler)
      );
    };
  }, []);

  // Simulate real-time data for demo purposes
  useEffect(() => {
    // For demo, we'll simulate the WebSocket connection
    const simulateConnection = () => {
      setState({
        connected: true,
        connecting: false,
        error: null,
        reconnectAttempts: 0,
      });
    };

    // Simulate connection after a short delay
    const timeout = setTimeout(simulateConnection, 500);

    return () => {
      clearTimeout(timeout);
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    on,
  };
}

// Hook for simulating real-time telemetry data
export function useSimulatedTelemetry(sessionId: string, enabled: boolean = true) {
  const [telemetry, setTelemetry] = useState({
    faceDetected: true,
    faceConfidence: 98,
    gazeDirection: 'center' as const,
    ambientNoise: 25,
    screenActive: true,
    browserFocused: true,
  });

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setTelemetry(prev => ({
        faceDetected: Math.random() > 0.05,
        faceConfidence: Math.max(85, Math.min(100, prev.faceConfidence + (Math.random() - 0.5) * 4)),
        gazeDirection: Math.random() > 0.8 
          ? ['left', 'right', 'up', 'down'][Math.floor(Math.random() * 4)] as any
          : 'center',
        ambientNoise: Math.max(20, Math.min(45, prev.ambientNoise + (Math.random() - 0.5) * 5)),
        screenActive: true,
        browserFocused: Math.random() > 0.1,
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionId, enabled]);

  return telemetry;
}

// Hook for simulating violations
export function useSimulatedViolations(sessionId: string, enabled: boolean = true) {
  const [violations, setViolations] = useState<any[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const violationTypes = ['looking_away', 'phone_detected', 'multiple_faces', 'voice_detected'];
    
    const interval = setInterval(() => {
      // 5% chance of violation every 10 seconds
      if (Math.random() > 0.95) {
        const newViolation = {
          id: `v-${Date.now()}`,
          type: violationTypes[Math.floor(Math.random() * violationTypes.length)],
          severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
          timestamp: new Date(),
          description: 'Suspicious activity detected',
          anomalyScore: Math.floor(Math.random() * 30) + 70,
        };
        setViolations(prev => [newViolation, ...prev].slice(0, 50));
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [sessionId, enabled]);

  return violations;
}
