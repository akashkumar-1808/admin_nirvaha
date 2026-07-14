'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  browserSessionPersistence,
  setPersistence
} from 'firebase/auth';
import { auth, isFirebaseClientConfigured } from '@/services/firebase/client';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  adminLoading: boolean;
  authError: string | null;
  logout: () => Promise<void>;
  isFirebaseConfigured: boolean;
  loginWithMock: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  adminLoading: false,
  authError: null,
  logout: async () => { },
  isFirebaseConfigured: false,
  loginWithMock: async () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const isConfigured = isFirebaseClientConfigured();
  const isMockBypass = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'false' ||
    !isConfigured ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'mock-api-key-abcdefghijk';

  useEffect(() => {
    // 1. Check if mock login session exists in storage
    if (typeof window !== 'undefined') {
      const savedMockEmail = sessionStorage.getItem('mock_user_email');
      if (savedMockEmail) {
        setUser({
          email: savedMockEmail,
          uid: 'mock-admin-uid-12345',
          getIdToken: async () => 'mock-id-token-xyz',
        } as any);
        setIsAdmin(true);
        setLoading(false);
        return;
      }
    }

    // 2. If mock bypass mode is forced, skip standard Firebase listeners
    if (isMockBypass || !auth) {
      setLoading(false);
      return;
    }

    // Set persistence to session or local storage
    setPersistence(auth, browserSessionPersistence).catch((err) => {
      console.warn('Persistence warning:', err);
    });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        setAdminLoading(true);
        setAuthError(null);
        try {
          const token = await currentUser.getIdToken(true);
          const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.authorized) {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
              setAuthError('Access Denied. You are not authorized to access Nirvaha Console.');
            }
          } else {
            const data = await response.json();
            setIsAdmin(false);
            setAuthError(data.error || 'Authorization check failed');
          }
        } catch (error: any) {
          console.error('Error verifying admin authorization:', error);
          setIsAdmin(false);
          setAuthError(error.message || 'Authorization check failed');
        } finally {
          setAdminLoading(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setAuthError(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithMock = async (email: string): Promise<boolean> => {
    setLoading(true);

    // In local mock bypass mode, allow any email format to log in instantly
    const mockUser = {
      email: email,
      uid: 'mock-admin-uid-12345',
      getIdToken: async () => 'mock-id-token-xyz',
    } as any;

    setUser(mockUser);
    setIsAdmin(true);
    setAuthError(null);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('mock_user_email', email);
    }
    setLoading(false);
    return true;
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('mock_user_email');
      }
      if (auth && auth.currentUser) {
        await signOut(auth);
      }
      setUser(null);
      setIsAdmin(false);
      setAuthError(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading: loading || adminLoading,
        adminLoading,
        authError,
        logout,
        isFirebaseConfigured: isConfigured,
        loginWithMock,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
