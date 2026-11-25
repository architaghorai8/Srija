import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : EPHEMERAL_FALLBACK_SECRET;
}

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (derived.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(derived, storedBuf);
  } catch {
    return false;
  }
}

export interface SessionPayload {
  uid: string;
  email: string;
  role: 'user' | 'admin';
  exp: number;
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>, ttlSeconds = 60 * 60 * 12): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!decoded.uid || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string;
    role: 'user' | 'admin';
    status: string;
    fullName: string;
    emailVerified: boolean;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  const user = db
    .prepare('SELECT uid, email, role, status, full_name, email_verified FROM users WHERE uid = ?')
    .get(payload.uid) as
    | {
        uid: string;
        email: string;
        role: string;
        status: string;
        full_name: string;
        email_verified: number;
      }
    | undefined;

  if (!user) {
    res.status(401).json({ error: 'Account not found.' });
    return;
  }

  if (user.status !== 'active') {
    res.status(403).json({ error: 'Account is currently suspended. Contact an administrator.' });
    return;
  }

  req.authUser = {
    uid: user.uid,
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'user',
    status: user.status,
    fullName: user.full_name,
    emailVerified: Boolean(user.email_verified),
  };
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!req.authUser || req.authUser.role !== 'admin') {
      db.prepare(
        'INSERT INTO audit_logs (id, actor_uid, actor_email, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        crypto.randomUUID(),
        req.authUser?.uid || 'anonymous',
        req.authUser?.email || 'unknown',
        'UNAUTHORIZED_ADMIN_ACCESS',
        'route',
        req.path,
        'Blocked non-admin access attempt to restricted administrative endpoint',
        new Date().toISOString()
      );
      res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
      return;
    }
    next();
  });
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function createRateLimiter(maxRequests: number, windowMs: number, label: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${label}:${ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (bucket.count >= maxRequests) {
      const retrySec = Math.ceil((bucket.resetAt - now) / 1000);
      res.status(429).json({
        error: `Too many requests. Please wait ${retrySec} seconds before trying again.`,
      });
      return;
    }
    bucket.count += 1;
    next();
  };
}

export function logUserActivity(uid: string, activityType: string, description: string, ipAddress = '') {
  db.prepare(
    'INSERT INTO user_activity (activity_id, uid, activity_type, description, ip_address, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(crypto.randomUUID(), uid, activityType, description, ipAddress, new Date().toISOString());
}

export function createUserNotification(uid: string, title: string, message: string) {
  db.prepare(
    'INSERT INTO notifications (notification_id, uid, title, message, read, created_at) VALUES (?, ?, ?, ?, 0, ?)'
  ).run(crypto.randomUUID(), uid, title, message, new Date().toISOString());
}

export function logAudit(
  actorUid: string | null,
  actorEmail: string | null,
  action: string,
  targetType: string,
  targetId = '',
  details = ''
) {
  db.prepare(
    'INSERT INTO audit_logs (id, actor_uid, actor_email, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(crypto.randomUUID(), actorUid, actorEmail, action, targetType, targetId, details, new Date().toISOString());
}
