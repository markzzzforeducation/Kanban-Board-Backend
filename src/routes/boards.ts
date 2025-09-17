import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from './auth';
import { z } from 'zod';

export const router = Router();

router.use(requireAuth);

router.get('/', async (req: any, res) => {
  const userId = req.userId as string;
  const boards = await prisma.board.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { id: userId } } }] },
    include: { members: true }
  });
  res.json(boards);
});

const createSchema = z.object({ name: z.string().min(1) });
router.post('/', async (req: any, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  const userId = req.userId as string;
  const board = await prisma.board.create({ data: { name: parse.data.name, ownerId: userId } });
  res.json(board);
});

const updateSchema = z.object({ name: z.string().min(1) });
router.put('/:id', async (req: any, res) => {
  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  const { id } = req.params;
  const board = await prisma.board.update({ where: { id }, data: { name: parse.data.name } });
  res.json(board);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params as any;
  await prisma.board.delete({ where: { id } });
  res.json({ ok: true });
});


