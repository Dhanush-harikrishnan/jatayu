import { Server, Socket } from 'socket.io';
import { logger } from '../logger';

export const registerWebRTCHandlers = (io: Server, socket: Socket, roomName: string) => {
  // SDP Offer
  socket.on('webrtc_offer', (data: { offer: any, targetRole: string }) => {
    logger.debug(`webrtc_offer from ${socket.data.user.role} to ${data.targetRole} in ${roomName}`);
    socket.to(roomName).emit('webrtc_offer', {
      offer: data.offer,
      fromRole: socket.data.user.role,
      targetRole: data.targetRole,
    });
  });

  // SDP Answer
  socket.on('webrtc_answer', (data: { answer: any, targetRole: string }) => {
    logger.debug(`webrtc_answer from ${socket.data.user.role} to ${data.targetRole} in ${roomName}`);
    socket.to(roomName).emit('webrtc_answer', {
      answer: data.answer,
      fromRole: socket.data.user.role,
      targetRole: data.targetRole,
    });
  });

  // ICE Candidate
  socket.on('webrtc_ice_candidate', (data: { candidate: any, targetRole: string }) => {
    logger.debug(`webrtc_ice_candidate from ${socket.data.user.role} to ${data.targetRole} in ${roomName}`);
    socket.to(roomName).emit('webrtc_ice_candidate', {
      candidate: data.candidate,
      fromRole: socket.data.user.role,
      targetRole: data.targetRole,
    });
  });
};
