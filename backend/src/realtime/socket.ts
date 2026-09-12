import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "node:http";
import { logger } from "../utils/logger";

let io: SocketIOServer | null = null;

export function initSocketServer(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Realtime client connected via Socket.IO");

    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, reason }, "Realtime client disconnected");
    });
  });

  logger.info("Socket.IO realtime server initialized");
  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}

export function emitSentinelEvent(event: string, payload: unknown): void {
  if (io) {
    io.emit(event, payload);
    logger.debug({ event, payload }, "Emitted realtime Socket.IO event");
  }
}
