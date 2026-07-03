import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import Project from '../models/Project';

let io: Server | null = null;

/**
 * Initializes Socket.IO with security handshake verification.
 */
export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' && process.env.DASHBOARD_URL
        ? process.env.DASHBOARD_URL.split(',')
        : '*',
      methods: ['GET', 'POST']
    }
  });

  // Authentication Handshake Middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        return next(new Error('Authentication failed: Missing token.'));
      }

      // Verify token
      const decoded = verifyToken(token);
      (socket as any).userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication failed: Invalid token.'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id} (User: ${(socket as any).userId})`);

    // Clients join specific project rooms to isolate streams
    socket.on('join-project', async (projectId: string) => {
      try {
        const userId = (socket as any).userId;
        // Verify user owns/belongs to this project
        const project = await Project.findOne({ _id: projectId, ownerId: userId });
        if (!project) {
          socket.emit('error', { message: 'Access denied: You do not own this project.' });
          return;
        }

        socket.join(`project:${projectId}`);
        console.log(`[Socket] Client ${socket.id} joined room: project:${projectId}`);
        socket.emit('joined', { projectId });
      } catch (err) {
        socket.emit('error', { message: 'Failed to join project room.' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Emits telemetry events to all listening clients in a project room.
 */
export function emitToProject(projectId: string, eventName: string, data: any): void {
  if (!io) {
    console.warn('[Socket] Socket server is not initialized yet.');
    return;
  }
  io.to(`project:${projectId}`).emit(eventName, data);
}
