import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/logger';
import { Errors, ApiError } from '../middleware/errors';

const router = Router();
const prisma = new PrismaClient();

// Middleware для проверки аутентификации
const requireAuth = (_req: Request, res: Response, next: NextFunction): any => {
  const token = _req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // TODO: Verify JWT token and extract phoneHash
  _req.user = { phoneHash: '' };
  next();
};

/**
 * GET /api/messages/pending
 * Получить все офлайн сообщения
 */
router.get(
  '/pending',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      throw Errors.UNAUTHORIZED;
    }

    const messages = await prisma.message.findMany({
      where: {
        toPhoneHash: userPhoneHash,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        fromPhoneHash: true,
        encryptedBlob: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const data = messages.map((msg: any) => ({
      id: msg.id,
      fromPhoneHash: msg.fromPhoneHash,
      encryptedBlob: msg.encryptedBlob,
      createdAt: msg.createdAt.toISOString(),
      expiresAt: msg.expiresAt.toISOString(),
    }));

    return res.json({
      data,
    });
  })
);

/**
 * DELETE /api/messages/:id
 * Удалить сообщение
 */
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      throw Errors.UNAUTHORIZED;
    }

    if (!id || id.length < 5) {
      throw new ApiError(400, 'Invalid message ID');
    }

    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      throw Errors.NOT_FOUND;
    }

    if (message.toPhoneHash !== userPhoneHash) {
      throw Errors.FORBIDDEN;
    }

    await prisma.message.delete({
      where: { id },
    });

    return res.json({
      data: {
        deleted: true,
        messageId: id,
      },
    });
  })
);

/**
 * POST /api/messages/batch-delete
 * Удалить несколько сообщений
 */
router.post(
  '/batch-delete',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { messageIds } = req.body;
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      throw Errors.UNAUTHORIZED;
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      throw new ApiError(400, 'Invalid message IDs');
    }

    const result = await prisma.message.deleteMany({
      where: {
        id: {
          in: messageIds,
        },
        toPhoneHash: userPhoneHash,
      },
    });

    return res.json({
      data: {
        deletedCount: result.count,
        messageIds: messageIds,
      },
    });
  })
);

/**
 * GET /api/messages/stats
 */
router.get(
  '/stats',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      throw Errors.UNAUTHORIZED;
    }

    const totalMessages = await prisma.message.count({
      where: {
        fromPhoneHash: userPhoneHash,
      },
    });

    const pendingCount = await prisma.message.count({
      where: {
        toPhoneHash: userPhoneHash,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    return res.json({
      data: {
        totalMessages,
        pendingCount,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * POST /api/messages/relay
 * Relay сообщение через сервер
 */
router.post(
  '/relay',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { toPhoneHash, encryptedBlob } = req.body;
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      throw Errors.UNAUTHORIZED;
    }

    if (!toPhoneHash || typeof toPhoneHash !== 'string') {
      throw new ApiError(400, 'toPhoneHash required');
    }

    if (!encryptedBlob || typeof encryptedBlob !== 'string') {
      throw new ApiError(400, 'encryptedBlob required');
    }

    // Проверяем существование получателя
    const recipient = await prisma.user.findUnique({
      where: { phoneHash: toPhoneHash },
    });

    if (!recipient) {
      throw Errors.NOT_FOUND;
    }

    // Создаем сообщение с TTL 7 дней
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const message = await prisma.message.create({
      data: {
        fromPhoneHash: userPhoneHash,
        toPhoneHash,
        encryptedBlob,
        expiresAt,
      },
    });

    return res.status(201).json({
      data: {
        messageId: message.id,
        status: 'stored',
        expiresAt: message.expiresAt.toISOString(),
      },
    });
  })
);

export default router;
