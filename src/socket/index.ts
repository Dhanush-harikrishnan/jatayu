import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from '../utils/jwt';
import { logger } from '../logger';
import { registerWebRTCHandlers } from './webrtcHandler';
import { registerTelemetryHandlers } from './telemetryHandler';
import { CorrelationEngine } from '../services/correlationEngine';

export let io: SocketIOServer;

export const initializeSocketServer = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket'], // As per explicit requirement
  });

  // Authentication Middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }
      const decoded = verifyToken(token);
      socket.data.user = decoded; // Store standard payload: role, sessionId, userId
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const { sessionId, role, userId } = socket.data.user;
    logger.info(`Socket connected: ${socket.id} (Role: ${role}, Session: ${sessionId})`);

    // Join room based on session (for laptop & mobile correlation)
    const roomName = `session_${sessionId}`;
    socket.join(roomName);
    
    // If admin, they could join an 'admin_room' to get all critical violations
    if (role === 'admin') {
      socket.join('admin_room');
    }

    // Initialize CorrelationEngine for this session if it doesn't exist
    // In cluster mode with Redis adapter, you would need distributed state.
    // Assuming local instance for MVP per PM2 clustering requirements without Redis explicitly requested.
    const engine = CorrelationEngine.getInstance(sessionId);

    registerWebRTCHandlers(io, socket, roomName);
    registerTelemetryHandlers(io, socket, roomName, engine);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
      // Clean up engine if all clients in session disconnected
      const clientsInRoom = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      if (clientsInRoom === 0) {
        CorrelationEngine.removeInstance(sessionId);
      }
    });
  });
};
