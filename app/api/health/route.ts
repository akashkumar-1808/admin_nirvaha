import { NextRequest, NextResponse } from 'next/server';
import { adminApp, isFirebaseAdminConfigured } from '@/services/firebase/admin';
import { isFirebaseClientConfigured } from '@/services/firebase/client';

export async function GET(req: NextRequest) {
  try {
    const isClientConfigured = isFirebaseClientConfigured();
    const isAdminConfigured = isFirebaseAdminConfigured();
    
    // Parse emails count
    const authorizedEmailsStr = process.env.AUTHORIZED_ADMIN_EMAILS || '';
    const authorizedEmailsCount = authorizedEmailsStr
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0).length;

    const healthStatus = {
      status: isClientConfigured && isAdminConfigured && adminApp ? 'healthy' : 'warning',
      timestamp: new Date().toISOString(),
      services: {
        firebaseClient: {
          configured: isClientConfigured,
          apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        },
        firebaseAdmin: {
          configured: isAdminConfigured,
          appInitialized: !!adminApp,
          projectId: !!process.env.FIREBASE_PROJECT_ID,
          clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        },
        authorization: {
          adminEmailsLoaded: authorizedEmailsCount,
        }
      }
    };

    return NextResponse.json(healthStatus, {
      status: healthStatus.status === 'healthy' ? 200 : 200 // Return 200 so page handles warn gracefully in UI
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message || 'Health check failed'
    }, { status: 500 });
  }
}
