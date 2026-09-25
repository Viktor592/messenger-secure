import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { validatePhoneHash, validateDisplayName } from '../utils/validation';
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
 * GET /api/contacts/search?phone=+7XXXXXXXXXX
 * Поиск контакта по номеру телефона
 */
router.get(
  '/search',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.query;

    if (!phone || typeof phone !== 'string') {
      throw new ApiError(400, 'Phone number required');
    }

    // Хешируем номер телефона
    const phoneHash = crypto.createHash('sha256').update(phone).digest('hex');

    // Ищем пользователя
    const user = await prisma.user.findUnique({
      where: { phoneHash },
      select: {
        phoneHash: true,
        publicKey: true,
        identityKeyFingerprint: true,
        displayName: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        data: {
          found: false,
          message: 'User not found',
        },
      });
    }

    return res.json({
      data: {
        found: true,
        phoneHash: user.phoneHash,
        publicKey: user.publicKey,
        identityKeyFingerprint: user.identityKeyFingerprint,
        displayName: user.displayName,
      },
    });
  })
);

/**
 * POST /api/contacts/add
 * Добавить контакт
 */
router.post(
  '/add',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { phoneHash, displayName } = req.body;

    // Validate
    if (!validatePhoneHash(phoneHash)) {
      throw new ApiError(400, 'Invalid phone hash');
    }

    if (!validateDisplayName(displayName)) {
      throw new ApiError(400, 'Invalid display name');
    }

    // Проверяем, существует ли пользователь
    const contact = await prisma.user.findUnique({
      where: { phoneHash },
      select: {
        phoneHash: true,
        displayName: true,
        publicKey: true,
        identityKeyFingerprint: true,
      },
    });

    if (!contact) {
      throw Errors.NOT_FOUND;
    }

    return res.json({
      data: {
        phoneHash: contact.phoneHash,
        displayName: contact.displayName,
        publicKey: contact.publicKey,
        identityKeyFingerprint: contact.identityKeyFingerprint,
        addedAt: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /api/contacts/verify/:fingerprint
 * Проверить идентичность контакта
 */
router.get(
  '/verify/:fingerprint',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { fingerprint } = req.params;

    if (!fingerprint || fingerprint.length < 16) {
      throw new ApiError(400, 'Invalid fingerprint');
    }

    // Ищем пользователя по fingerprint
    const user = await prisma.user.findFirst({
      where: {
        identityKeyFingerprint: fingerprint,
      },
      select: {
        phoneHash: true,
        displayName: true,
        identityKeyFingerprint: true,
      },
    });

    if (!user) {
      return res.json({
        data: {
          verified: false,
          message: 'No matching user found',
        },
      });
    }

    return res.json({
      data: {
        verified: true,
        phoneHash: user.phoneHash,
        displayName: user.displayName,
        fingerprint: user.identityKeyFingerprint,
      },
    });
  })
);

/**
 * GET /api/contacts/list
 */
router.get(
  '/list',
  requireAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    return res.json({
      data: [],
    });
  })
);

export default router;
