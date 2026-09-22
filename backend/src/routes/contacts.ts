import { Router, Request, Response } from 'express';
import { verify } from '../crypto/noise';
import { prisma } from '../db';
import { validatePhoneHash, validateDisplayName } from '../utils/validation';
import crypto from 'crypto';

const router = Router();

// Middleware для проверки аутентификации
const requireAuth = (req: Request, res: Response, next: Function) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // TODO: Verify JWT token
  req.user = { phoneHash: '' }; // Placeholder
  next();
};

/**
 * GET /api/contacts/search?phone=+7XXXXXXXXXX
 * Поиск контакта по номеру телефона
 * Возвращает: publicKey, identityKeyFingerprint (если найден), displayName
 */
router.get('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phone } = req.query;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Phone number required' });
    }

    // Хешируем номер телефона как на фронте
    const phoneHash = crypto
      .createHash('sha256')
      .update(phone)
      .digest('hex');

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
  } catch (error) {
    console.error('Contact search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/contacts/add
 * Добавить контакт в список контактов (локально на клиенте)
 * После добавления контакта, клиент может установить X3DH сессию
 */
router.post('/add', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phoneHash, displayName } = req.body;

    // Validate
    if (!validatePhoneHash(phoneHash)) {
      return res.status(400).json({ error: 'Invalid phone hash' });
    }

    if (!validateDisplayName(displayName)) {
      return res.status(400).json({ error: 'Invalid display name' });
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
      return res.status(404).json({ error: 'Contact not found' });
    }

    // В реальном приложении здесь был бы список контактов пользователя
    // Но контакты хранятся локально на клиенте в encrypted storage
    // Сервер просто подтверждает, что пользователь существует

    return res.json({
      data: {
        phoneHash: contact.phoneHash,
        displayName: contact.displayName,
        publicKey: contact.publicKey,
        identityKeyFingerprint: contact.identityKeyFingerprint,
        addedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Add contact error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/contacts/verify/:fingerprint
 * Проверить идентичность контакта по fingerprint
 * Используется для TOFU (Trust On First Use) верификации
 */
router.get('/verify/:fingerprint', requireAuth, async (req: Request, res: Response) => {
  try {
    const { fingerprint } = req.params;

    if (!fingerprint || fingerprint.length < 16) {
      return res.status(400).json({ error: 'Invalid fingerprint' });
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
  } catch (error) {
    console.error('Verify contact error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/contacts/list
 * Получить список контактов пользователя
 * (В этой реализации контакты хранятся локально,
 *  но сервер может предоставить кэшированный список)
 */
router.get('/list', requireAuth, async (req: Request, res: Response) => {
  try {
    // В реальной системе здесь была бы таблица UserContacts
    // Для теста возвращаем пустой список
    // Клиент управляет своим списком контактов локально

    return res.json({
      data: [],
    });
  } catch (error) {
    console.error('List contacts error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
