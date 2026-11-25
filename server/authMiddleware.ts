import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { UserRole } from '../src/types/edna.ts';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

const BOOTSTRAP_ADMIN_EMAIL = 'dolimondal9903@gmail.com';

function loadFirebaseConfig(): FirebaseAppletConfig | null {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as FirebaseAppletConfig;
    if (!raw.projectId || raw.projectId === 'remixed-project-id') return null;
    return raw;
  } catch {
    return null;
  }
}

export function getFirebaseProjectConfig(): FirebaseAppletConfig | null {
  return loadFirebaseConfig();
}

function getFirebaseAdminAuth() {
  const cfg = loadFirebaseConfig();
  if (!cfg) {
    throw new Error('Firebase configuration missing or unprovisioned.');
  }
  const app = getApps().length ? getApp() : initializeApp({ projectId: cfg.projectId });
  return getAuth(app);
}

export interface VerifiedRequestUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  accountStatus: 'active' | 'suspended';
  idToken: string;
}

export interface AuthenticatedRequest extends Request {
  user?: VerifiedRequestUser;
}

/**
 * Fetches the user's authoritative Firestore profile using their verified ID token
 * via Firestore REST API (strictly enforced by firestore.rules, requires no IAM).
 */
async function fetchUserProfileFromFirestoreRest(
  uid: string,
  idToken: string
): Promise<{ role?: UserRole; accountStatus?: 'active' | 'suspended' } | null> {
  const cfg = loadFirebaseConfig();
  if (!cfg) return null;
  const dbId = cfg.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/${encodeURIComponent(dbId)}/documents/users/${encodeURIComponent(uid)}`;

  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!resp.ok) return null;
    const doc = (await resp.json()) as {
      fields?: {
        role?: { stringValue?: string };
        accountStatus?: { stringValue?: string };
      };
    };
    const roleVal = doc.fields?.role?.stringValue;
    const statusVal = doc.fields?.accountStatus?.stringValue;
    return {
      role: roleVal === 'admin' || roleVal === 'super_admin' || roleVal === 'user' ? roleVal : undefined,
      accountStatus: statusVal === 'suspended' ? 'suspended' : 'active',
    };
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization Bearer token.' });
    return;
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Empty authentication token.' });
    return;
  }

  try {
    const adminAuth = getFirebaseAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = decoded.email ?? '';
    const emailVerified = Boolean(decoded.email_verified);

    const profileData = await fetchUserProfileFromFirestoreRest(decoded.uid, idToken);
    let role: UserRole = profileData?.role ?? 'user';
    const accountStatus = profileData?.accountStatus ?? 'active';

    if (email === BOOTSTRAP_ADMIN_EMAIL && emailVerified) {
      role = 'super_admin';
    }

    if (accountStatus === 'suspended') {
      res.status(403).json({ error: 'Account is suspended. Contact an administrator.' });
      return;
    }

    req.user = {
      uid: decoded.uid,
      email,
      emailVerified,
      role,
      accountStatus,
      idToken,
    };
    next();
  } catch (err) {
    console.error('Token verification failed:', err instanceof Error ? err.message : err);
    res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!req.user.emailVerified) {
    res.status(403).json({ error: 'Verified email required for administrative access.' });
    return;
  }
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    res.status(403).json({ error: '403 Unauthorized: Administrator role required.' });
    return;
  }
  next();
}
