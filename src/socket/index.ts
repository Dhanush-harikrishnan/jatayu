import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from '../utils/jwt';
import { logger } from '../logger';
import { registerWebRTCHandlers } from './webrtcHandler';
import { registerTelemetryHandlers } from './telemetryHandler';
import { CorrelationEngine } from '../services/correlationEngine';
import { sessionRegistry } from '../services/sessionRegistry';
import { awsService } from '../services/awsService';
import { config } from '../config/env';

export let io: SocketIOServer;

export const initializeSocketServer = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: config.cors.allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
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

    if (role === 'primary') {
      const tokenUser: any = socket.data.user;
      sessionRegistry.upsert({
        sessionId,
        studentId: userId || sessionId,
        studentName: tokenUser.name || userId || sessionId,
        examId: tokenUser.examId || 'EXAM-101',
        status: 'online',
      });
    }

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
    const tokenUser: any = socket.data.user;
    const engine = CorrelationEngine.getInstance(sessionId, {
      userId: tokenUser.userId,
      studentName: tokenUser.name,
      examId: tokenUser.examId,
    });

    registerWebRTCHandlers(io, socket, roomName);
    registerTelemetryHandlers(io, socket, roomName, engine);

    // Log a SESSION_STARTED event so the admin dashboard shows this student even without violations
    if (role === 'primary') {
      const ctx = { userId: tokenUser.userId, studentName: tokenUser.name, examId: tokenUser.examId };
      awsService.logViolationEvent(
        sessionId,
        new Date().toISOString(),
        'SESSION_STARTED',
        '',
        { confidence: 1 },
        ctx
      ).catch((err: any) => logger.error('Failed to log session start to DynamoDB:', err));
    }

    // Listen for mobile-paired event and broadcast to the room
    socket.on('mobile-paired', (data: any) => {
      logger.info(`Mobile device paired in session ${sessionId}`);
      // Broadcast to all other clients in the room (i.e., the primary/desktop)
      socket.to(roomName).emit('mobile-paired', data);
    });

    // Explicit end-exam event: only fires when the student intentionally finishes
    socket.on('end-exam', () => {
      if (role === 'primary') {
        logger.info(`Exam explicitly ended by primary in session ${sessionId}`);
        io.to(roomName).emit('exam-ended', { timestamp: Date.now() });
        sessionRegistry.touch(sessionId, 'offline');
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
      if (role === 'primary') {
        sessionRegistry.touch(sessionId, 'offline');
        // Do NOT emit exam-ended here — primary socket disconnects on page
        // navigation (e.g. setup → proctoring) and would falsely kill the
        // mobile camera session.  Only an explicit 'end-exam' event should
        // terminate the mobile session.
      }
      // Clean up engine if all clients in session disconnected
      const clientsInRoom = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      if (clientsInRoom === 0) {
        CorrelationEngine.removeInstance(sessionId);
      }
    });
  });
};
