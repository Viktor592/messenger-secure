import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import crypto from 'crypto';

const router = Router();

// Middleware для проверки аутентификации
const requireAuth = (req: Request, res: Response, next: Function) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // TODO: Verify JWT token and extract phoneHash
  req.user = { phoneHash: '' }; // Placeholder
  next();
};

/**
 * GET /api/messages/pending
 * Получить все офлайн сообщения для этого пользователя
 * Сообщения хранятся как зашифрованные блобы (сервер не может их прочитать)
 */
router.get('/pending', requireAuth, async (req: Request, res: Response) => {
  try {
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Получаем все сообщения, которые еще не истекли
    const messages = await prisma.message.findMany({
      where: {
        toPhoneHash: userPhoneHash,
        expiresAt: {
          gt: new Date(), // Еще не истекли
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

    // Преобразуем в JSON безопасно
    const data = messages.map((msg) => ({
      id: msg.id,
      fromPhoneHash: msg.fromPhoneHash,
      encryptedBlob: msg.encryptedBlob,
      createdAt: msg.createdAt.toISOString(),
      expiresAt: msg.expiresAt.toISOString(),
    }));

    return res.json({
      data,
    });
  } catch (error) {
    console.error('Get pending messages error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/messages/:id
 * Удалить сообщение после получения и расшифровки
 * Это гарантирует, что сообщение удалится с сервера
 * (даже если клиент потеряет соединение после расшифровки)
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!id || id.length < 5) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    // Находим сообщение и проверяем права
    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Проверяем, что это сообщение адресовано текущему пользователю
    if (message.toPhoneHash !== userPhoneHash) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Удаляем сообщение
    await prisma.message.delete({
      where: { id },
    });

    return res.json({
      data: {
        deleted: true,
        messageId: id,
      },
    });
  } catch (error) {
    console.error('Delete message error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/messages/batch-delete
 * Удалить несколько сообщений одновременно
 */
router.post('/batch-delete', requireAuth, async (req: Request, res: Response) => {
  try {
    const { messageIds } = req.body;
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'Invalid message IDs' });
    }

    // Удаляем сообщения только для этого пользователя
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
  } catch (error) {
    console.error('Batch delete messages error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/messages/stats
 * Получить статистику сообщений для пользователя
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Общее количество сообщений от этого пользователя
    const totalMessages = await prisma.message.count({
      where: {
        fromPhoneHash: userPhoneHash,
      },
    });

    // Количество ожидающих сообщений
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
  } catch (error) {
    console.error('Get message stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/messages/relay
 * Relay сообщение через сервер если получатель офлайн
 * Используется когда оба клиента не могут установить P2P соединение
 * 
 * Сообщение уже зашифровано end-to-end и сервер не видит контент
 */
router.post('/relay', requireAuth, async (req: Request, res: Response) => {
  try {
    const { toPhoneHash, encryptedBlob } = req.body;
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!toPhoneHash || typeof toPhoneHash !== 'string') {
      return res.status(400).json({ error: 'toPhoneHash required' });
    }

    if (!encryptedBlob || typeof encryptedBlob !== 'string') {
      return res.status(400).json({ error: 'encryptedBlob required' });
    }

    // Проверяем существование получателя
    const recipient = await prisma.user.findUnique({
      where: { phoneHash: toPhoneHash },
    });

    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
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

    // TODO: Notify recipient via Socket.io if online

    return res.status(201).json({
      data: {
        messageId: message.id,
        status: 'stored',
        expiresAt: message.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Relay message error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
