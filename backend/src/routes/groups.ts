import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
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
 * POST /api/groups/create
 */
router.post(
  '/create',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, memberPhoneHashes } = req.body;
    const creatorPhoneHash = req.user?.phoneHash;

    if (!creatorPhoneHash) {
      throw Errors.UNAUTHORIZED;
    }

    if (!name || typeof name !== 'string' || name.length < 1) {
      throw new ApiError(400, 'Group name required');
    }

    if (!Array.isArray(memberPhoneHashes) || memberPhoneHashes.length === 0) {
      throw new ApiError(400, 'At least one member required');
    }

    // Создаем группу
    const groupId = uuidv4();

    const group = await prisma.group.create({
      data: {
        id: groupId,
        name,
        creatorPhoneHash,
        members: {
          create: [
            {
              memberPhoneHash: creatorPhoneHash,
              role: 'admin',
            },
            ...memberPhoneHashes
              .filter((hash: string) => hash !== creatorPhoneHash)
              .map((hash: string) => ({
                memberPhoneHash: hash,
                role: 'member' as const,
              })),
          ],
        },
      },
      include: {
        members: true,
      },
    });

    return res.status(201).json({
      data: {
        id: group.id,
        name: group.name,
        creatorPhoneHash: group.creatorPhoneHash,
        memberCount: group.members.length,
        createdAt: group.createdAt.toISOString(),
      },
    });
  })
);

/**
 * GET /api/groups/list
 */
router.get(
  '/list',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      throw Errors.UNAUTHORIZED;
    }

    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            memberPhoneHash: userPhoneHash,
          },
        },
      },
      include: {
        members: {
          select: {
            memberPhoneHash: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({
      data: groups.map((group: any) => ({
        id: group.id,
        name: group.name,
        creatorPhoneHash: group.creatorPhoneHash,
        memberCount: group.members.length,
        userRole: group.members.find((m: any) => m.memberPhoneHash === userPhoneHash)?.role,
        createdAt: group.createdAt.toISOString(),
      })),
    });
  })
);

/**
 * GET /api/groups/:id
 */
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      throw Errors.UNAUTHORIZED;
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            memberPhoneHash: true,
            role: true,
          },
        },
      },
    });

    if (!group) {
      throw Errors.NOT_FOUND;
    }

    const isMember = group.members.some((m: any) => m.memberPhoneHash === userPhoneHash);
    if (!isMember) {
      throw Errors.FORBIDDEN;
    }

    return res.json({
      data: {
        id: group.id,
        name: group.name,
        creatorPhoneHash: group.creatorPhoneHash,
        members: group.members,
        createdAt: group.createdAt.toISOString(),
      },
    });
  })
);

/**
 * POST /api/groups/:id/add-member
 */
router.post(
  '/:id/add-member',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { phoneHash } = req.body;
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      throw Errors.UNAUTHORIZED;
    }

    if (!phoneHash || typeof phoneHash !== 'string') {
      throw new ApiError(400, 'Phone hash required');
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: true,
      },
    });

    if (!group) {
      throw Errors.NOT_FOUND;
    }

    const userRole = group.members.find((m: any) => m.memberPhoneHash === userPhoneHash)?.role;
    if (userRole !== 'admin') {
      throw new ApiError(403, 'Only admins can add members');
    }

    const alreadyMember = group.members.some((m: any) => m.memberPhoneHash === phoneHash);
    if (alreadyMember) {
      throw Errors.CONFLICT;
    }

    await prisma.groupMember.create({
      data: {
        groupId: id,
        memberPhoneHash: phoneHash,
        role: 'member',
      },
    });

    return res.status(201).json({
      data: {
        groupId: id,
        memberPhoneHash: phoneHash,
        role: 'member',
      },
    });
  })
);

/**
 * POST /api/groups/:id/leave
 */
router.post(
  '/:id/leave',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userPhoneHash = req.user?.phoneHash;

    if (!userPhoneHash) {
      throw Errors.UNAUTHORIZED;
    }

    const result = await prisma.groupMember.deleteMany({
      where: {
        groupId: id,
        memberPhoneHash: userPhoneHash,
      },
    });

    if (result.count === 0) {
      throw Errors.NOT_FOUND;
    }

    return res.json({
      data: {
        groupId: id,
        left: true,
      },
    });
  })
);

/**
 * DELETE /api/groups/:id
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

    const group = await prisma.group.findUnique({
      where: { id },
    });

    if (!group) {
      throw Errors.NOT_FOUND;
    }

    if (group.creatorPhoneHash !== userPhoneHash) {
      throw Errors.FORBIDDEN;
    }

    await prisma.group.delete({
      where: { id },
    });

    return res.json({
      data: {
        groupId: id,
        deleted: true,
      },
    });
  })
);

export default router;
