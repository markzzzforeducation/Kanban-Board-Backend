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
    include: { members: true, columns: { orderBy: { order: 'asc' }, include: { tasks: true } } }
  });
  // Normalize task.tags to string[] for FE
  const normalized = boards.map((b: any) => ({
    ...b,
    columns: b.columns.map((c: any) => ({
      ...c,
      tasks: c.tasks.map((t: any) => ({ ...t, tags: JSON.parse(t.tags || '[]') }))
    }))
  }));
  res.json(normalized);
});

const createSchema = z.object({ name: z.string().min(1) });
router.post('/', async (req: any, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  const userId = req.userId as string;
  const board = await prisma.board.create({ data: { name: parse.data.name, ownerId: userId } });
  console.log('[BOARD] created', { boardId: board.id, ownerId: userId, name: board.name });
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


// Columns CRUD
const createColumnSchema = z.object({ title: z.string().min(1), order: z.coerce.number().int() });
router.post('/:id/columns', async (req: any, res) => {
  try {
    console.log('[COLUMN/CREATE] payload', { params: req.params, body: req.body, userId: req.userId });
    const parse = createColumnSchema.safeParse(req.body);
    if (!parse.success) {
      console.log('[COLUMN/CREATE] invalid payload', parse.error.flatten());
      return res.status(400).json({ errors: parse.error.flatten() });
    }
    const boardId = req.params.id as string;
    const userId = req.userId as string;
    const board = await prisma.board.findUnique({ where: { id: boardId }, include: { members: true } });
    console.log('[COLUMN/CREATE] board', { found: !!board, boardId });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (board.ownerId !== userId && !board.members.some(m => m.id === userId)) {
      console.log('[COLUMN/CREATE] forbidden', { userId });
      return res.status(403).json({ error: 'Not a board member' });
    }
    const col = await prisma.column.create({ data: { title: parse.data.title, order: parse.data.order, boardId }, include: { tasks: true } });
    console.log('[COLUMN/CREATE] created', { columnId: col.id });
    res.json(col);
  } catch (e) {
    console.error('[COLUMN/CREATE] error', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

const updateColumnSchema = z.object({ title: z.string().min(1).optional(), order: z.coerce.number().int().optional() }).refine((v) => v.title !== undefined || v.order !== undefined, { message: 'At least one of title or order is required' });
router.put('/columns/:columnId', async (req: any, res) => {
  try {
    console.log('[COLUMN/UPDATE] payload', { params: req.params, body: req.body, userId: req.userId });
    const parse = updateColumnSchema.safeParse(req.body);
    if (!parse.success) {
      console.log('[COLUMN/UPDATE] invalid payload', parse.error.flatten());
      return res.status(400).json({ errors: parse.error.flatten() });
    }
    const { columnId } = req.params as any;
    const userId = req.userId as string;
    const col = await prisma.column.findUnique({ where: { id: columnId }, include: { board: { include: { members: true } } } });
    if (!col) return res.status(404).json({ error: 'Column not found' });
    if (col.board.ownerId !== userId && !col.board.members.some(m => m.id === userId)) {
      console.log('[COLUMN/UPDATE] forbidden', { userId });
      return res.status(403).json({ error: 'Not a board member' });
    }
    const updated = await prisma.column.update({ where: { id: columnId }, data: parse.data, include: { tasks: true } });
    console.log('[COLUMN/UPDATE] updated', { columnId: updated.id });
    res.json(updated);
  } catch (e) {
    console.error('[COLUMN/UPDATE] error', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/columns/:columnId', async (req: any, res) => {
  try {
    console.log('[COLUMN/DELETE] payload', { params: req.params, userId: req.userId });
    const { columnId } = req.params as any;
    const userId = req.userId as string;
    const col = await prisma.column.findUnique({ where: { id: columnId }, include: { board: { include: { members: true } } } });
    if (!col) return res.status(404).json({ error: 'Column not found' });
    if (col.board.ownerId !== userId && !col.board.members.some(m => m.id === userId)) {
      console.log('[COLUMN/DELETE] forbidden', { userId });
      return res.status(403).json({ error: 'Not a board member' });
    }
    // Ensure tasks are removed first to avoid FK constraint issues
    await prisma.task.deleteMany({ where: { columnId } });
    await prisma.column.delete({ where: { id: columnId } });
    console.log('[COLUMN/DELETE] deleted', { columnId });
    res.json({ ok: true });
  } catch (e) {
    console.error('[COLUMN/DELETE] error', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Tasks CRUD + tags + assignees + reorder
const createTaskSchema = z.object({
  title: z.string().min(1),
  columnId: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  assigneeIds: z.array(z.string()).optional()
});

router.post('/:boardId/tasks', async (req: any, res) => {
  try {
    const parse = createTaskSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
    const { boardId } = req.params as any;
    const userId = req.userId as string;
    const board = await prisma.board.findUnique({ where: { id: boardId }, include: { members: true } });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (board.ownerId !== userId && !board.members.some(m => m.id === userId)) {
      return res.status(403).json({ error: 'Not a board member' });
    }
    const column = await prisma.column.findUnique({ where: { id: parse.data.columnId } });
    if (!column || column.boardId !== boardId) return res.status(400).json({ error: 'Invalid columnId' });

    const last = await prisma.task.findFirst({ where: { columnId: column.id }, orderBy: { order: 'desc' } });
    const order = last ? last.order + 1 : 0;
    const created = await prisma.task.create({
      data: {
        title: parse.data.title,
        description: parse.data.description ?? null,
        order,
        columnId: column.id,
        tags: JSON.stringify(parse.data.tags ?? []),
        assignees: parse.data.assigneeIds ? { connect: parse.data.assigneeIds.map((id: string) => ({ id })) } : undefined
      },
      include: { assignees: true }
    });
    res.json({ ...created, tags: JSON.parse(created.tags || '[]') });
  } catch (e) {
    console.error('[TASK/CREATE] error', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

const updateTaskSchema = z.object({ title: z.string().min(1).optional(), description: z.string().optional() })
  .refine(v => v.title !== undefined || v.description !== undefined, { message: 'title or description required' });

router.put('/tasks/:taskId', async (req: any, res) => {
  try {
    const parse = updateTaskSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
    const { taskId } = req.params as any;
    const userId = req.userId as string;
    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { column: { include: { board: { include: { members: true } } } } } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const board = (task as any).column.board;
    if (board.ownerId !== userId && !board.members.some((m: any) => m.id === userId)) {
      return res.status(403).json({ error: 'Not a board member' });
    }
    const updated = await prisma.task.update({ where: { id: taskId }, data: { title: parse.data.title, description: parse.data.description }, include: { assignees: true } });
    res.json({ ...updated, tags: JSON.parse(updated.tags || '[]') });
  } catch (e) {
    console.error('[TASK/UPDATE] error', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/tasks/:taskId', async (req: any, res) => {
  try {
    const { taskId } = req.params as any;
    const userId = req.userId as string;
    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { column: { include: { board: { include: { members: true } } } } } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const board = (task as any).column.board;
    if (board.ownerId !== userId && !board.members.some((m: any) => m.id === userId)) {
      return res.status(403).json({ error: 'Not a board member' });
    }
    await prisma.task.delete({ where: { id: taskId } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[TASK/DELETE] error', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

const updateTagsSchema = z.object({ tags: z.array(z.string()) });
router.put('/tasks/:taskId/tags', async (req: any, res) => {
  try {
    const parse = updateTagsSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
    const { taskId } = req.params as any;
    const userId = req.userId as string;
    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { column: { include: { board: { include: { members: true } } } } } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const board = (task as any).column.board;
    if (board.ownerId !== userId && !board.members.some((m: any) => m.id === userId)) {
      return res.status(403).json({ error: 'Not a board member' });
    }
    const updated = await prisma.task.update({ where: { id: taskId }, data: { tags: JSON.stringify(parse.data.tags) }, include: { assignees: true } });
    res.json({ ...updated, tags: JSON.parse(updated.tags || '[]') });
  } catch (e) {
    console.error('[TASK/TAGS] error', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

const updateAssigneesSchema = z.object({ assigneeIds: z.array(z.string()) });
router.put('/tasks/:taskId/assignees', async (req: any, res) => {
  try {
    const parse = updateAssigneesSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
    const { taskId } = req.params as any;
    const userId = req.userId as string;
    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { column: { include: { board: { include: { members: true } } } } } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const board = (task as any).column.board;
    if (board.ownerId !== userId && !board.members.some((m: any) => m.id === userId)) {
      return res.status(403).json({ error: 'Not a board member' });
    }
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        assignees: { set: [], connect: parse.data.assigneeIds.map((id: string) => ({ id })) }
      },
      include: { assignees: true }
    });
    res.json({ ...updated, tags: JSON.parse(updated.tags || '[]') });
  } catch (e) {
    console.error('[TASK/ASSIGNEES] error', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

const reorderSchema = z.object({
  fromColumnId: z.string().min(1),
  toColumnId: z.string().min(1),
  taskId: z.string().min(1),
  toIndex: z.coerce.number().int().min(0)
});

router.put('/:boardId/tasks/reorder', async (req: any, res) => {
  try {
    const parse = reorderSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
    const { boardId } = req.params as any;
    const userId = req.userId as string;
    const board = await prisma.board.findUnique({ where: { id: boardId }, include: { members: true } });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (board.ownerId !== userId && !board.members.some((m: any) => m.id === userId)) {
      return res.status(403).json({ error: 'Not a board member' });
    }

    const { fromColumnId, toColumnId, taskId, toIndex } = parse.data as any;
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.columnId !== fromColumnId) return res.status(400).json({ error: 'Task not in fromColumnId' });

    if (fromColumnId === toColumnId) {
      const tasks = await prisma.task.findMany({ where: { columnId: fromColumnId }, orderBy: { order: 'asc' } });
      const ids = tasks.map(t => t.id).filter((id: string) => id !== taskId);
      const boundedIndex = Math.max(0, Math.min(toIndex, ids.length));
      ids.splice(boundedIndex, 0, taskId);
      await prisma.$transaction(ids.map((id: string, idx: number) => prisma.task.update({ where: { id }, data: { order: idx } })));
    } else {
      const source = await prisma.task.findMany({ where: { columnId: fromColumnId }, orderBy: { order: 'asc' } });
      const target = await prisma.task.findMany({ where: { columnId: toColumnId }, orderBy: { order: 'asc' } });
      const sourceIds = source.map(t => t.id).filter((id: string) => id !== taskId);
      const targetIds = target.map(t => t.id);
      const boundedIndex = Math.max(0, Math.min(toIndex, targetIds.length));
      targetIds.splice(boundedIndex, 0, taskId);
      await prisma.$transaction([
        ...sourceIds.map((id: string, idx: number) => prisma.task.update({ where: { id }, data: { order: idx } })),
        prisma.task.update({ where: { id: taskId }, data: { columnId: toColumnId } }),
        ...targetIds.map((id: string, idx: number) => prisma.task.update({ where: { id }, data: { order: idx } }))
      ]);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[TASK/REORDER] error', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Invite a user to a board by email or userId and create a notification
const inviteSchema = z.union([
  z.object({ email: z.string().email() }),
  z.object({ userId: z.string().min(1) })
]);
router.post('/:id/invite', async (req: any, res) => {
  try {
    const parse = inviteSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
    const boardId = req.params.id as string;
    const inviterId = req.userId as string;

    const board = await prisma.board.findUnique({ where: { id: boardId }, include: { owner: true, members: true } });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (board.ownerId !== inviterId && !board.members.some(m => m.id === inviterId)) {
      return res.status(403).json({ error: 'Not a board member' });
    }

    const where = 'email' in parse.data ? { email: parse.data.email } : { id: (parse.data as any).userId };
    const invitee = await prisma.user.findUnique({ where });
    if (!invitee) return res.status(404).json({ error: 'User not found' });

    // Add member if not already
    const alreadyMember = await prisma.board.findFirst({ where: { id: boardId, members: { some: { id: invitee.id } } } });
    if (!alreadyMember) {
      await prisma.board.update({ where: { id: boardId }, data: { members: { connect: { id: invitee.id } } } });
    }

    // Create a notification for the invitee
    const inviter = await prisma.user.findUnique({ where: { id: inviterId } });
    const noti = await prisma.notification.create({
      data: {
        userId: invitee.id,
        type: 'INVITE',
        message: `${inviter?.name || 'Someone'} added you to board "${board.name}"`,
        boardId,
      }
    });
    console.log('[INVITE] notification created', { notiId: noti.id, inviteeId: invitee.id });

    res.json({ ok: true });
  } catch (e) {
    console.error('[INVITE] error', e);
    res.status(500).json({ error: 'Internal error' });
  }
});


