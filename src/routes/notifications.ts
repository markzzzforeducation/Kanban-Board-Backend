import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from './auth';
import { z } from 'zod';

export const router = Router();

router.use(requireAuth);

// GET /api/notifications - list current user's notifications
router.get('/', async (req: any, res) => {
  const userId = req.userId as string;
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(notifications);
});

// POST /api/notifications/read-all - mark all as read
router.post('/read-all', async (req: any, res) => {
  const userId = req.userId as string;
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  res.json({ ok: true });
});

// POST /api/notifications/:id/read - mark one as read
router.post('/:id/read', async (req: any, res) => {
  const userId = req.userId as string;
  const { id } = req.params;
  const noti = await prisma.notification.findUnique({ where: { id } });
  if (!noti || noti.userId !== userId) return res.status(404).json({ error: 'Not found' });
  await prisma.notification.update({ where: { id }, data: { read: true } });
  res.json({ ok: true });
});


