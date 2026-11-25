import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  ActivityLog,
  NotificationItem,
  Project,
  SystemSettings,
  UserProfile,
} from '../types/edna.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const BOOTSTRAP_ADMIN_EMAIL = 'dolimondal9903@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export async function configureAuthPersistence(rememberMe: boolean) {
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

export async function ensureUserProfile(params: {
  uid: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  organization?: string;
  country?: string;
  researchInterests?: string;
}): Promise<UserProfile | null> {
  if (!params.emailVerified) return null;

  const userPath = `users/${params.uid}`;
  const ref = doc(db, 'users', params.uid);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    const isBootstrap = params.email === BOOTSTRAP_ADMIN_EMAIL;
    const payload: Record<string, unknown> = {
      uid: params.uid,
      fullName: (params.fullName || params.email.split('@')[0] || 'Researcher').trim().slice(0, 120),
      email: params.email.trim().slice(0, 254),
      organization: (params.organization ?? '').trim().slice(0, 160),
      country: (params.country ?? '').trim().slice(0, 100),
      researchInterests: (params.researchInterests ?? '').trim().slice(0, 400),
      role: isBootstrap ? 'super_admin' : 'user',
      accountStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, payload);

    await createNotification({
      uid: params.uid,
      title: 'Welcome to eDNA Biodiversity Explorer',
      message: 'Your verified research workspace is ready. Upload an eDNA dataset or explore demonstration samples.',
      category: 'info',
    });

    await logUserActivity(params.uid, 'ACCOUNT_INITIALIZED', 'Verified researcher workspace created');

    const freshSnap = await getDoc(ref);
    return freshSnap.exists() ? (freshSnap.data() as UserProfile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateUserProfileFields(
  uid: string,
  updates: {
    fullName: string;
    organization: string;
    country: string;
    researchInterests: string;
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      fullName: updates.fullName.trim().slice(0, 120),
      organization: updates.organization.trim().slice(0, 160),
      country: updates.country.trim().slice(0, 100),
      researchInterests: updates.researchInterests.trim().slice(0, 400),
      updatedAt: serverTimestamp(),
    });
    await logUserActivity(uid, 'PROFILE_UPDATED', 'Updated researcher profile metadata');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserProjects(
  uid: string,
  onData: (projects: Project[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'projects'), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as Project);
      items.sort((a, b) => {
        const ta = (a.updatedAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
        const tb = (b.updatedAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'projects');
    }
  );
}

export async function createProject(params: {
  ownerUid: string;
  projectName: string;
  description?: string;
  biome?: string;
  location?: string;
}): Promise<Project> {
  const projectId = sanitizeId(`proj_${crypto.randomUUID().slice(0, 12)}`);
  const path = `projects/${projectId}`;
  const docData = {
    projectId,
    ownerUid: params.ownerUid,
    projectName: params.projectName.trim().slice(0, 140),
    description: (params.description ?? '').trim().slice(0, 1000),
    biome: (params.biome ?? '').trim().slice(0, 80),
    location: (params.location ?? '').trim().slice(0, 140),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'projects', projectId), docData);
    await logUserActivity(params.ownerUid, 'PROJECT_CREATED', params.projectName.trim().slice(0, 140));
    return docData as unknown as Project;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProject(
  projectId: string,
  ownerUid: string,
  updates: { projectName: string; description?: string; biome?: string; location?: string }
): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      projectName: updates.projectName.trim().slice(0, 140),
      description: (updates.description ?? '').trim().slice(0, 1000),
      biome: (updates.biome ?? '').trim().slice(0, 80),
      location: (updates.location ?? '').trim().slice(0, 140),
      updatedAt: serverTimestamp(),
    });
    await logUserActivity(ownerUid, 'PROJECT_UPDATED', updates.projectName.trim().slice(0, 140));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProject(projectId: string, ownerUid: string): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
    await logUserActivity(ownerUid, 'PROJECT_DELETED', projectId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createNotification(params: {
  uid: string;
  title: string;
  message: string;
  category: 'info' | 'analysis' | 'system' | 'security';
}): Promise<void> {
  const notificationId = sanitizeId(`notif_${crypto.randomUUID().slice(0, 12)}`);
  const path = `notifications/${notificationId}`;
  try {
    await setDoc(doc(db, 'notifications', notificationId), {
      notificationId,
      uid: params.uid,
      title: params.title.trim().slice(0, 140),
      message: params.message.trim().slice(0, 500),
      category: params.category,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserNotifications(
  uid: string,
  onData: (items: NotificationItem[]) => void
): Unsubscribe {
  const q = query(collection(db, 'notifications'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as NotificationItem);
      list.sort((a, b) => {
        const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
        const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    }
  );
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function logUserActivity(uid: string, action: string, details = ''): Promise<void> {
  const activityId = sanitizeId(`act_${crypto.randomUUID().slice(0, 12)}`);
  const path = `activity_logs/${activityId}`;
  try {
    await setDoc(doc(db, 'activity_logs', activityId), {
      activityId,
      uid,
      action: action.trim().slice(0, 120),
      details: details.trim().slice(0, 300),
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchUserActivityLogs(uid: string): Promise<ActivityLog[]> {
  try {
    const q = query(collection(db, 'activity_logs'), where('uid', '==', uid), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ActivityLog);
  } catch {
    // Fallback without composite index if index is not built yet
    try {
      const q = query(collection(db, 'activity_logs'), where('uid', '==', uid));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => d.data() as ActivityLog);
      list.sort((a, b) => {
        const ta = (a.timestamp as { toMillis?: () => number })?.toMillis?.() ?? 0;
        const tb = (b.timestamp as { toMillis?: () => number })?.toMillis?.() ?? 0;
        return tb - ta;
      });
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'activity_logs');
    }
  }
}

export async function fetchSystemSettings(): Promise<SystemSettings> {
  const fallback: SystemSettings = {
    settingId: 'global',
    maxUploadSizeMb: 25,
    allowedExtensions: ['.fasta', '.fa', '.fastq', '.fq', '.csv', '.tsv'],
    defaultReferenceDb: 'SILVA 138.1 / BOLD v4 / MitoFish v3.95',
    maintenanceMode: false,
  };
  try {
    const snap = await getDoc(doc(db, 'system_settings', 'global'));
    if (snap.exists()) {
      return snap.data() as SystemSettings;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export async function saveSystemSettings(
  adminUid: string,
  settings: Omit<SystemSettings, 'settingId' | 'updatedAt' | 'updatedBy'>
): Promise<void> {
  const path = 'system_settings/global';
  try {
    await setDoc(doc(db, 'system_settings', 'global'), {
      settingId: 'global',
      maxUploadSizeMb: Math.min(500, Math.max(1, Number(settings.maxUploadSizeMb) || 25)),
      allowedExtensions: settings.allowedExtensions.length
        ? settings.allowedExtensions
        : ['.fasta', '.fa', '.fastq', '.fq', '.csv', '.tsv'],
      defaultReferenceDb: settings.defaultReferenceDb.trim().slice(0, 120),
      maintenanceMode: Boolean(settings.maintenanceMode),
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
