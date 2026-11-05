import { NextRequest } from 'next/server';
import { adminAuth } from '@/services/firebase/admin';

export interface UserAuthResult {
  authorized: boolean;
  uid?: string;
  email?: string;
  isAdmin?: boolean;
  error?: string;
  status?: number;
}

export interface AdminAuthResult {
  authorized: boolean;
  uid?: string;
  email?: string;
  isAdmin?: boolean;
  error?: string;
  status?: number;
}

/**
 * Extracts Bearer token from Request / NextRequest Authorization header.
 * Performs case-insensitive header lookup and strips leading/trailing whitespace.
 */
export function extractBearerToken(req: Request | NextRequest): string | null {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Checks whether an email address is listed in the comma-separated
 * AUTHORIZED_ADMIN_EMAILS environment variable (case-insensitive).
 */
export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) {
    return false;
  }
  const authorizedEmailsStr = process.env.AUTHORIZED_ADMIN_EMAILS || '';
  const authorizedEmails = authorizedEmailsStr
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  return authorizedEmails.includes(email.trim().toLowerCase());
}

/**
 * Determines whether a decoded Firebase token has administrative privileges.
 * Privileges are granted if:
 * 1. The custom claim `decodedToken.admin === true`, OR
 * 2. The token email is in AUTHORIZED_ADMIN_EMAILS.
 */
export function checkIsAdmin(decodedToken: { admin?: unknown; email?: string }): boolean {
  if (decodedToken.admin === true) {
    return true;
  }
  return isAuthorizedAdminEmail(decodedToken.email);
}

/**
 * Verifies Firebase ID token for any authenticated user.
 * Suitable for endpoints accessible to regular users (e.g. mobile app booking creation).
 * 
 * Returns:
 * - { authorized: true, uid, email, isAdmin, status: 200 } on success
 * - { authorized: false, error, status } on failure (401 for bad token, 500 for unconfigured SDK)
 */
export async function verifyUserRequest(
  req: Request | NextRequest
): Promise<UserAuthResult> {
  // 1. Verify Firebase Admin SDK is initialized
  if (!adminAuth) {
    return {
      authorized: false,
      error: 'Firebase Admin SDK not initialized on server',
      status: 500,
    };
  }

  // 2. Extract Bearer token
  const token = extractBearerToken(req);
  if (!token) {
    return {
      authorized: false,
      error: 'Missing or invalid Authorization header',
      status: 401,
    };
  }

  // 3. Verify ID token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email;
    const isAdmin = checkIsAdmin(decodedToken);

    if (!uid) {
      return {
        authorized: false,
        error: 'No user ID found in token payload',
        status: 401,
      };
    }

    return {
      authorized: true,
      uid,
      email,
      isAdmin,
      status: 200,
    };
  } catch (error: any) {
    console.error('Error verifying Firebase ID token:', error);
    return {
      authorized: false,
      error: error.message || 'Token verification failed',
      status: 401,
    };
  }
}

/**
 * Verifies Firebase ID token and enforces admin authorization.
 * Privileged actions require custom claim `admin === true` or email in AUTHORIZED_ADMIN_EMAILS.
 * 
 * Returns:
 * - { authorized: true, uid, email, isAdmin: true, status: 200 } on success
 * - { authorized: false, error, status } on failure (401 invalid token, 403 non-admin, 500 unconfigured SDK)
 */
export async function verifyAdminRequest(
  req: Request | NextRequest
): Promise<AdminAuthResult> {
  const userResult = await verifyUserRequest(req);

  if (!userResult.authorized) {
    return userResult;
  }

  if (!userResult.isAdmin) {
    const identifier = userResult.email || userResult.uid || 'unknown user';
    console.warn(`🔒 Access Denied: ${identifier} is not authorized for admin operations`);
    return {
      authorized: false,
      uid: userResult.uid,
      email: userResult.email,
      isAdmin: false,
      error: 'You are not authorized to perform this admin action',
      status: 403,
    };
  }

  return {
    authorized: true,
    uid: userResult.uid,
    email: userResult.email,
    isAdmin: true,
    status: 200,
  };
}
