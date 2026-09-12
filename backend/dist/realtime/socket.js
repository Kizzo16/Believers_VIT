"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocketServer = initSocketServer;
exports.getSocketServer = getSocketServer;
exports.emitSentinelEvent = emitSentinelEvent;
const socket_io_1 = require("socket.io");
const logger_1 = require("../utils/logger");
let io = null;
function initSocketServer(server) {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    io.on("connection", (socket) => {
        logger_1.logger.info({ socketId: socket.id }, "Realtime client connected via Socket.IO");
        socket.on("disconnect", (reason) => {
            logger_1.logger.info({ socketId: socket.id, reason }, "Realtime client disconnected");
        });
    });
    logger_1.logger.info("Socket.IO realtime server initialized");
    return io;
}
function getSocketServer() {
    return io;
}
function emitSentinelEvent(event, payload) {
    if (io) {
        io.emit(event, payload);
        logger_1.logger.debug({ event, payload }, "Emitted realtime Socket.IO event");
    }
}
