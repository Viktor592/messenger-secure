import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import twilio from 'twilio';
import validator from 'validator';
import { hashValue, generateToken, verifyToken } from '../crypto/noise';
import { Errors, ApiError } from '../middleware/errors';
import { asyncHandler } from '../middleware/logger';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Twilio client (optional, for SMS)
const twilioClient = process.env.TWILIO_ACCOUNT_SID
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// ============================================
// POST /api/auth/register
// Request phone → Send SMS code
// ============================================
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.body;

    // Validate input
    if (!phone || typeof phone !== 'string') {
      throw Errors.PHONE_REQUIRED;
    }

    const normalizedPhone = phone.replace(/[^\d+]/g, '');
    
    if (!validator.isMobilePhone(normalizedPhone)) {
      throw Errors.INVALID_PHONE;
    }

    // Rate limiting: max 5 SMS per phone per hour
    const phoneHash = hashValue(normalizedPhone);
    const smsCountKey = `sms:count:${phoneHash}`;
    const smsCount = await redis.incr(smsCountKey);
    
    if (smsCount === 1) {
      await redis.expire(smsCountKey, 3600); // 1 hour
    }

    if (smsCount > 5) {
      throw Errors.TOO_MANY_ATTEMPTS;
    }

    // Generate SMS code (6 digits)
    const smsCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = hashValue(smsCode);

    // Store code in database (10 min TTL)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    await prisma.smsCode.upsert({
      where: { phoneHash },
      update: {
        codeHash,
        attemptCount: 0,
        expiresAt,
      },
      create: {
        phoneHash,
        codeHash,
        attemptCount: 0,
        expiresAt,
      },
    });

    // Send SMS (if Twilio configured)
    if (twilioClient && process.env.FEATURE_SMS_VERIFICATION_ENABLED === 'true') {
      try {
        await twilioClient.messages.create({
          body: `Your Messenger Secure verification code: ${smsCode}`,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: normalizedPhone,
        });
      } catch (err) {
        console.error('SMS sending failed:', err);
        // In production, this should trigger an alert
        // But don't block the user
      }
    } else {
      // Development: log the code
      console.log(`SMS Code for ${normalizedPhone}: ${smsCode}`);
    }

    // Return session token (doesn't authenticate, just identifies this registration attempt)
    const sessionToken = generateToken(32);
    await redis.setex(
      `session:${sessionToken}`,
      600, // 10 minutes
      JSON.stringify({ phoneHash, phone: normalizedPhone })
    );

    res.status(200).json({
      smsRequired: true,
      sessionToken,
      message: 'SMS code sent to your phone',
    });
  })
);

// ============================================
// POST /api/auth/verify
// SMS code + public key → JWT tokens
// ============================================
router.post(
  '/verify',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionToken, smsCode, publicKey } = req.body;

    // Validate input
    if (!sessionToken || typeof sessionToken !== 'string') {
      throw Errors.INVALID_TOKEN;
    }

    if (!smsCode || typeof smsCode !== 'string' || smsCode.length !== 6) {
      throw Errors.INVALID_CODE;
    }

    if (!publicKey || typeof publicKey !== 'string') {
      throw new ApiError(400, 'Public key is required');
    }

    // Get session
    const sessionData = await redis.get(`session:${sessionToken}`);
    if (!sessionData) {
      throw Errors.INVALID_TOKEN;
    }

    const { phoneHash, phone: normalizedPhone } = JSON.parse(sessionData);

    // Verify SMS code
    const expectedCodeHash = hashValue(smsCode);
    const smsRecord = await prisma.smsCode.findUnique({
      where: { phoneHash },
    });

    if (!smsRecord) {
      throw Errors.INVALID_CODE;
    }

    // Check expiry
    if (new Date() > smsRecord.expiresAt) {
      throw new ApiError(400, 'SMS code expired');
    }

    // Check attempts
    if (smsRecord.attemptCount >= smsRecord.maxAttempts) {
      throw new ApiError(429, 'Too many verification attempts');
    }

    // Verify code (constant-time)
    const codeMatches = verifyToken(expectedCodeHash, smsRecord.codeHash);
    
    if (!codeMatches) {
      // Increment attempts
      await prisma.smsCode.update({
        where: { phoneHash },
        data: { attemptCount: smsRecord.attemptCount + 1 },
      });
      throw Errors.INVALID_CODE;
    }

    // Create or update user
    const user = await prisma.user.upsert({
      where: { phoneHash },
      update: {
        publicKey,
        lastSeenAt: new Date(),
      },
      create: {
        phoneHash,
        publicKey,
      },
    });

    // Delete SMS code
    await prisma.smsCode.delete({
      where: { phoneHash },
    });

    // Delete session token
    await redis.del(`session:${sessionToken}`);

    // Generate JWT tokens
    const accessToken = jwt.sign(
      {
        userId: user.id,
        phoneHash,
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: process.env.JWT_EXPIRE_ACCESS || '15m' }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.id,
        phoneHash,
        type: 'refresh',
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: process.env.JWT_EXPIRE_REFRESH || '30d' }
    );

    // Store session in database
    const sessionRecord = await prisma.session.create({
      data: {
        userPhoneHash: phoneHash,
        tokenHash: hashValue(accessToken),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        ipAddress: req.ip,
      },
    });

    res.status(200).json({
      userId: user.id,
      phoneHash,
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
      message: 'Successfully authenticated',
    });
  })
);

// ============================================
// POST /api/auth/refresh
// Refresh JWT token
// ============================================
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw Errors.INVALID_TOKEN;
    }

    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_SECRET || 'dev-secret'
      ) as any;

      if (decoded.type !== 'refresh') {
        throw Errors.INVALID_TOKEN;
      }

      // Generate new access token
      const newAccessToken = jwt.sign(
        {
          userId: decoded.userId,
          phoneHash: decoded.phoneHash,
        },
        process.env.JWT_SECRET || 'dev-secret',
        { expiresIn: process.env.JWT_EXPIRE_ACCESS || '15m' }
      );

      res.status(200).json({
        accessToken: newAccessToken,
        expiresIn: 900,
      });
    } catch (err) {
      throw Errors.INVALID_TOKEN;
    }
  })
);

// ============================================
// POST /api/auth/logout
// Clear session
// ============================================
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({ message: 'Logged out' });
    }

    const token = authHeader.slice(7);
    const tokenHash = hashValue(token);

    await prisma.session.deleteMany({
      where: { tokenHash },
    });

    res.status(200).json({ message: 'Logged out successfully' });
  })
);

export default router;
