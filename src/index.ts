import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { json } from 'express';
import { router as authRouter } from './routes/auth';
import { router as boardsRouter } from './routes/boards';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true }));
app.use(json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/boards', boardsRouter);

const PORT = Number(process.env.PORT || 5174);
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});


