import { Router } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';

export const router = Router();

// Google OAuth client
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/google/callback'
);

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6)
});

router.post('/register', async (req, res) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  const { name, email, password } = parse.data;
  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({ data: { name, email, password: hashed } });
    res.json({ id: user.id, name: user.name, email: user.email });
  } catch (e) {
    res.status(400).json({ error: 'Email already in use' });
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/login', async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  const { email, password } = parse.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// Google OAuth endpoints
router.post('/google/initiate', async (req, res) => {
  try {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/auth/google/callback`;
    const authUrl = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['profile', 'email'],
      prompt: 'select_account',
      redirect_uri: redirectUri
    });
    console.log('[GOOGLE/INITIATE] redirect_uri:', redirectUri);
    res.json({ authUrl });
  } catch (error) {
    console.error('Google OAuth initiate error:', error);
    res.status(500).json({ error: 'Failed to initiate Google OAuth' });
  }
});

router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Authorization code required' });

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/auth/google/callback`;
    console.log('[GOOGLE/CALLBACK] redirect_uri:', redirectUri);
    console.log('[GOOGLE/CALLBACK] GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
    console.log('[GOOGLE/CALLBACK] GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '***SET***' : 'NOT SET');

    const { tokens } = await googleClient.getToken({
      code,
      redirect_uri: redirectUri
    });
    googleClient.setCredentials(tokens);

    console.log('[GOOGLE/CALLBACK] tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasIdToken: !!tokens.id_token
    });

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) return res.status(400).json({ error: 'Invalid Google token' });

    console.log('[GOOGLE/CALLBACK] payload:', {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name
    });

    const { sub: googleId, email, name, picture } = payload;

    // Find or create user
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      // Check if user exists with same email but different provider
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        // Link Google account to existing user
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: { provider: 'google', googleId, avatar: picture }
        });
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            name: name || 'Google User',
            email: email!,
            password: '', // No password for Google users
            provider: 'google',
            googleId,
            avatar: picture
          }
        });
      }
    }

    // Generate JWT token
    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider
      }
    });
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Direct Google login (alternative to callback)
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'ID token required' });

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) return res.status(400).json({ error: 'Invalid Google token' });

    const { sub: googleId, email, name, picture } = payload;

    // Find or create user (same logic as callback)
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: { provider: 'google', googleId, avatar: picture }
        });
      } else {
        user = await prisma.user.create({
          data: {
            name: name || 'Google User',
            email: email!,
            password: '',
            provider: 'google',
            googleId,
            avatar: picture
          }
        });
      }
    }

    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider
      }
    });
  } catch (error) {
    console.error('Google direct login error:', error);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

export function requireAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
    req.userId = payload.sub as string;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}


