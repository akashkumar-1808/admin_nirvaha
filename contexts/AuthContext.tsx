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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  adminLoading: false,
  authError: null,
  logout: async () => {},
  isFirebaseConfigured: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const isConfigured = isFirebaseClientConfigured();

  useEffect(() => {
    if (!auth) {
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

          let data: any = null;
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            try {
              data = await response.json();
            } catch (e) {
              console.error('Failed to parse auth verification JSON:', e);
            }
          }

          if (response.ok && data) {
            if (data.authorized) {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
              setAuthError('Access Denied. You are not authorized to access Nirvaha Console.');
            }
          } else {
            setIsAdmin(false);
            setAuthError(
              data?.error || 
              `Authorization check failed (Status ${response.status}: ${response.statusText || 'Server Error'})`
            );
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

  const logout = async () => {
    setLoading(true);
    try {
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
