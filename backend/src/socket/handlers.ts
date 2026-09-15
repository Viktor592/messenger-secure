import { Server as SocketIOServer, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Logger } from 'pino';
import { hashValue } from '../crypto/noise';

export function setupSocketHandlers(
  io: SocketIOServer,
  prisma: PrismaClient,
  redis: Redis,
  logger: Logger
) {
  // ============================================
  // CONNECTION EVENTS
  // ============================================

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId;
    const phoneHash = socket.data.phoneHash;

    logger.info(`[SOCKET] User connected: ${userId} (${socket.id})`);

    // Store socket connection info
    const socketKey = `socket:${socket.id}`;
    await redis.setex(
      socketKey,
      3600, // 1 hour
      JSON.stringify({
        userId,
        phoneHash,
        connectedAt: Date.now(),
      })
    );

    // Emit connection ready
    socket.emit('connection_ready', {
      userId,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    // ============================================
    // PRESENCE TRACKING
    // ============================================

    socket.on('presence:update', async (data) => {
      const { status } = data; // 'online', 'typing', 'offline'

      if (!['online', 'typing', 'offline'].includes(status)) {
        return;
      }

      await redis.setex(
        `presence:${userId}`,
        3600,
        JSON.stringify({
          status,
          socketId: socket.id,
          lastActive: Date.now(),
        })
      );

      logger.info(`[PRESENCE] ${userId} → ${status}`);

      // Notify contacts (if needed)
      // This would iterate through contacts and emit to their sockets
    });

    // ============================================
    // MESSAGING (P2P SIGNALING)
    // ============================================

    /**
     * Signal WebRTC Offer
     * Alice → Server → Bob
     */
    socket.on('signal:offer', async (data) => {
      const { toUserId, sdpOffer } = data;

      logger.info(`[SIGNAL] Offer: ${userId} → ${toUserId}`);

      // Store offer temporarily
      const offerKey = `signal:${toUserId}:offers`;
      const offer = {
        from: userId,
        fromSocketId: socket.id,
        sdp: sdpOffer,
        timestamp: Date.now(),
      };

      await redis.lpush(offerKey, JSON.stringify(offer));
      await redis.expire(offerKey, 300); // 5 minutes

      // Try to relay to recipient if online
      const recipientSockets = await io.in(toUserId).fetchSockets();
      if (recipientSockets.length > 0) {
        io.to(toUserId).emit('signal:offer', {
          fromUserId: userId,
          sdpOffer,
        });
      }
    });

    /**
     * Signal WebRTC Answer
     * Bob → Server → Alice
     */
    socket.on('signal:answer', async (data) => {
      const { toUserId, sdpAnswer } = data;

      logger.info(`[SIGNAL] Answer: ${userId} → ${toUserId}`);

      const answerKey = `signal:${toUserId}:answers`;
      const answer = {
        from: userId,
        fromSocketId: socket.id,
        sdp: sdpAnswer,
        timestamp: Date.now(),
      };

      await redis.lpush(answerKey, JSON.stringify(answer));
      await redis.expire(answerKey, 300);

      // Relay to recipient
      const recipientSockets = await io.in(toUserId).fetchSockets();
      if (recipientSockets.length > 0) {
        io.to(toUserId).emit('signal:answer', {
          fromUserId: userId,
          sdpAnswer,
        });
      }
    });

    /**
     * ICE Candidate
     * peer1 → Server → peer2
     */
    socket.on('signal:ice_candidate', async (data) => {
      const { toUserId, candidate } = data;

      logger.debug(`[ICE] ${userId} → ${toUserId}`);

      // Store ICE candidate temporarily
      const iceKey = `signal:${toUserId}:ice`;
      await redis.lpush(iceKey, JSON.stringify({
        from: userId,
        candidate,
        timestamp: Date.now(),
      }));
      await redis.expire(iceKey, 300);

      // Relay immediately if recipient online
      const recipientSockets = await io.in(toUserId).fetchSockets();
      if (recipientSockets.length > 0) {
        io.to(toUserId).emit('signal:ice_candidate', {
          fromUserId: userId,
          candidate,
        });
      }
    });

    // ============================================
    // MESSAGE RELAY (Offline Queue)
    // ============================================

    /**
     * Send encrypted message
     * If recipient offline → store in DB (TTL 7 days)
     * If online → relay directly
     */
    socket.on('message:send', async (data, callback) => {
      const { toPhoneHash, toUserId, encryptedPayload, deliveryReceipt } = data;

      try {
        logger.info(`[MESSAGE] ${userId} → ${toUserId || toPhoneHash}`);

        // Validate payload
        if (!encryptedPayload || typeof encryptedPayload !== 'string') {
          return callback({ error: 'Invalid payload' });
        }

        // Check if recipient online
        const recipientSockets = toUserId 
          ? await io.in(toUserId).fetchSockets()
          : [];

        if (recipientSockets.length > 0) {
          // Recipient online: relay directly (P2P)
          io.to(toUserId).emit('message:receive', {
            fromUserId: userId,
            fromPhoneHash: phoneHash,
            encryptedPayload,
            timestamp: Date.now(),
          });

          callback({ status: 'delivered', messageId: Date.now() });
        } else {
          // Recipient offline: store in database
          const message = await prisma.message.create({
            data: {
              fromPhoneHash: phoneHash,
              toPhoneHash: toPhoneHash || hashValue(toUserId),
              encryptedBlob: encryptedPayload,
            },
          });

          callback({ 
            status: 'queued', 
            messageId: message.id,
            expiresIn: 604800, // 7 days in seconds
          });
        }
      } catch (err) {
        logger.error('Message send error:', err);
        callback({ error: 'Failed to send message' });
      }
    });

    /**
     * Acknowledge message receipt
     */
    socket.on('message:ack', async (data) => {
      const { messageId } = data;

      try {
        // Delete message from queue after receipt
        await prisma.message.delete({
          where: { id: messageId },
        });

        logger.debug(`[ACK] Message ${messageId} delivered`);
      } catch (err) {
        logger.debug(`Message not found or already deleted: ${messageId}`);
      }
    });

    // ============================================
    // GROUP MESSAGING
    // ============================================

    /**
     * Send message to group
     */
    socket.on('group:message', async (data, callback) => {
      const { groupId, encryptedPayload } = data;

      try {
        // Check group membership
        const membership = await prisma.groupMember.findFirst({
          where: {
            groupId,
            memberPhoneHash: phoneHash,
          },
        });

        if (!membership) {
          return callback({ error: 'Not a group member' });
        }

        // Broadcast to all group members (if online)
        // In production, also queue for offline members
        io.emit('group:message', {
          groupId,
          fromUserId: userId,
          fromPhoneHash: phoneHash,
          encryptedPayload,
          timestamp: Date.now(),
        });

        callback({ status: 'sent', messageId: Date.now() });
      } catch (err) {
        logger.error('Group message error:', err);
        callback({ error: 'Failed to send group message' });
      }
    });

    // ============================================
    // CLEANUP ON DISCONNECT
    // ============================================

    socket.on('disconnect', async () => {
      logger.info(`[SOCKET] User disconnected: ${userId} (${socket.id})`);

      // Remove socket info
      await redis.del(`socket:${socket.id}`);

      // Update last seen timestamp
      await prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() },
      });

      // Remove presence (if no other sockets)
      const userSockets = await io.in(userId).fetchSockets();
      if (userSockets.length === 0) {
        await redis.del(`presence:${userId}`);
        logger.info(`[PRESENCE] ${userId} marked offline`);
      }
    });

    // ============================================
    // ERROR HANDLING
    // ============================================

    socket.on('error', (err) => {
      logger.error(`[SOCKET] Error for ${userId}:`, err);
    });
  });

  // ============================================
  // CLEANUP JOBS
  // ============================================

  /**
   * Periodically cleanup expired messages and sessions
   */
  setInterval(async () => {
    try {
      // Delete expired messages (>7 days)
      const deletedMessages = await prisma.message.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (deletedMessages.count > 0) {
        logger.info(`Cleanup: Deleted ${deletedMessages.count} expired messages`);
      }

      // Delete expired sessions (>30 days)
      const deletedSessions = await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (deletedSessions.count > 0) {
        logger.info(`Cleanup: Deleted ${deletedSessions.count} expired sessions`);
      }

      // Delete expired SMS codes (>10 minutes)
      const deletedSMS = await prisma.smsCode.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (deletedSMS.count > 0) {
        logger.info(`Cleanup: Deleted ${deletedSMS.count} expired SMS codes`);
      }
    } catch (err) {
      logger.error('Cleanup job error:', err);
    }
  }, 60 * 1000); // Every minute
}
