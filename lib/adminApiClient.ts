'use client';

import { auth } from '@/services/firebase/client';

/**
 * Authenticated API client for admin console pages.
 * Automatically attaches the Firebase ID token to every request.
 */

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (err) {
      console.error('Failed to get auth token:', err);
    }
  }
  return headers;
}

export interface AdminApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  details?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export async function adminFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<AdminApiResponse<T>> {
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await res.json();
  }

  if (!res.ok) {
    return {
      success: false,
      error: `Request failed with status ${res.status}`,
    };
  }

  return { success: true, data: undefined as any };
}

export async function adminGet<T = any>(
  url: string,
  params?: Record<string, string | number | undefined>
): Promise<AdminApiResponse<T>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== 'all') {
        searchParams.set(key, String(value));
      }
    });
  }
  const queryString = searchParams.toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  return adminFetch<T>(fullUrl);
}

export async function adminPost<T = any>(
  url: string,
  body: any
): Promise<AdminApiResponse<T>> {
  return adminFetch<T>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminPut<T = any>(
  url: string,
  body: any
): Promise<AdminApiResponse<T>> {
  return adminFetch<T>(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function adminDelete<T = any>(
  url: string
): Promise<AdminApiResponse<T>> {
  return adminFetch<T>(url, {
    method: 'DELETE',
  });
}

