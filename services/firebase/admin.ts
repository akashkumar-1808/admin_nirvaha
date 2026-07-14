import { getApps, initializeApp, getApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';

const getFirebaseAdminConfig = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    // Strip surrounding quotes if they exist
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
      privateKey = privateKey.slice(1, -1);
    }
    // Handle escaped newlines in env variables
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  return { projectId, clientEmail, privateKey };
};

export const isFirebaseAdminConfigured = (): boolean => {
  const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig();
  
  if (!projectId || !clientEmail || !privateKey) {
    return false;
  }
  
  // Suppress initialization if the project is our default mock placeholder
  const isMockKey = projectId === 'nirvaha-mock-project' || privateKey.includes('mock-api-key') || privateKey.length < 100;
  return !isMockKey;
};

const getAdminApp = (): App | null => {
  if (getApps().length > 0) {
    return getApp();
  }

  if (!isFirebaseAdminConfigured()) {
    // Skip initialization for dry-runs/mock environment validation
    return null;
  }

  const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig();

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    return null;
  }
};

const adminApp = getAdminApp();

// Access Auth and Messaging services
export const adminAuth = adminApp ? getAuth(adminApp) : null;
export const adminMessaging = adminApp ? getMessaging(adminApp) : null;
export { adminApp };
