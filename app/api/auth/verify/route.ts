import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/services/firebase/admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Admin SDK is configured
    if (!adminAuth) {
      return NextResponse.json(
        { authorized: false, error: 'Firebase Admin SDK not initialized on server' },
        { status: 500 }
      );
    }

    // 2. Extract authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { authorized: false, error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];

    // 3. Verify ID token
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = decodedToken.email;
    const uid = decodedToken.uid;

    if (!email) {
      return NextResponse.json(
        { authorized: false, error: 'No email found in token payload' },
        { status: 400 }
      );
    }

    // 4. Verify admin status:
    // Check Custom Claim first, then check AUTHORIZED_ADMIN_EMAILS env variable
    let isAuthorized = decodedToken.admin === true;

    if (!isAuthorized) {
      const authorizedEmailsStr = process.env.AUTHORIZED_ADMIN_EMAILS || '';
      const authorizedEmails = authorizedEmailsStr
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0);

      isAuthorized = authorizedEmails.includes(email.toLowerCase());
    }

    if (!isAuthorized) {
      console.warn(`🔒 Access Denied for email: ${email}`);
      return NextResponse.json(
        { authorized: false, error: 'You are not authorized to access Nirvaha Console' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      authorized: true,
      email,
      uid,
      role: 'admin',
    });
  } catch (error: any) {
    console.error('Error verifying token:', error);
    return NextResponse.json(
      { authorized: false, error: error.message || 'Verification failed' },
      { status: 401 }
    );
  }
}
