'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/services/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert, Lock, Mail, ServerCrash, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, isAdmin, loading, authError, isFirebaseConfigured, logout } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // If user is already logged in and verified as admin, redirect to dashboard
    if (user && isAdmin && !loading) {
      router.replace('/dashboard');
    }
  }, [user, isAdmin, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    
    if (!email || !password) {
      setFormError('Please enter both email and password.');
      return;
    }

    setSigningIn(true);
    setFormError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Auth state listener in AuthContext handles authorization redirect
      toast('Login authenticated, verifying credentials...', 'info');
    } catch (err: any) {
      console.error('Sign-in error:', err);
      let errMsg = 'Failed to sign in. Please verify your credentials.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errMsg = 'Invalid email or password.';
      } else if (err.code === 'auth/too-many-requests') {
        errMsg = 'Too many failed login attempts. Please try again later.';
      }
      setFormError(errMsg);
      toast(errMsg, 'error');
      setSigningIn(false);
    }
  };

  const handleLogoutUnauthorized = async () => {
    try {
      await logout();
      setEmail('');
      setPassword('');
      setSigningIn(false);
      setFormError(null);
    } catch (err) {
      console.error(err);
    }
  };

  // 1. Firebase Env Configuration Missing State
  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background select-none">
        <Card className="max-w-md w-full border-destructive/30 bg-card/60 backdrop-blur-sm p-6 text-center">
          <CardHeader className="flex flex-col items-center">
            <div className="h-12 w-12 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-3">
              <ServerCrash className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Configuration Error</CardTitle>
            <CardDescription className="text-muted-foreground/80 mt-1">
              Firebase Environment Variables are Missing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-secondary-foreground leading-relaxed">
              The Firebase Client SDK is not initialized. Please define the required variables in your <code>.env.local</code> file:
            </p>
            <div className="bg-black/20 rounded-xl p-3 text-left font-mono text-xs text-muted-foreground/85 border border-border/25 space-y-1">
              <div>NEXT_PUBLIC_FIREBASE_API_KEY=...</div>
              <div>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...</div>
              <div>NEXT_PUBLIC_FIREBASE_PROJECT_ID=...</div>
            </div>
            <p className="text-xs text-muted-foreground/60 leading-normal">
              Restart your Next.js dev server after adding environment secrets.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Authenticated but Unauthorized State (Access Denied)
  if (user && !isAdmin && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background select-none">
        <Card className="max-w-md w-full border-destructive/40 bg-card/70 backdrop-blur-sm p-6">
          <CardHeader className="flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive mb-4 shadow-[0_4px_16px_rgba(239,68,68,0.1)]">
              <ShieldAlert className="h-7 w-7 animate-pulse" />
            </div>
            <CardTitle className="text-2xl font-serif">Access Denied</CardTitle>
            <CardDescription className="text-muted-foreground/80 mt-1">
              You are not authorized to access Nirvaha Console.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex flex-col items-center">
            <div className="w-full bg-destructive/5 border border-destructive/25 rounded-xl p-4 text-center">
              <p className="text-sm text-foreground/90 font-medium truncate mb-1">
                Authenticated User:
              </p>
              <p className="text-sm font-semibold text-secondary-foreground truncate">
                {user.email}
              </p>
            </div>
            {authError && (
              <div className="w-full p-3 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-xs text-center font-mono break-words leading-relaxed select-text">
                ⚠️ {authError}
              </div>
            )}
            <p className="text-xs text-muted-foreground/75 leading-relaxed text-center">
              Only authorized Nirvaha administrators can view internal operations. If you believe this is an error, please request your email to be added to the server configuration.
            </p>
            <Button
              onClick={handleLogoutUnauthorized}
              variant="secondary"
              className="w-full h-11"
            >
              Sign Out & Try Another Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Normal Sign-In State
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Background breathing glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none animate-breathe" />

      <Card className="max-w-md w-full border-border/40 bg-card/60 backdrop-blur-md p-6 shadow-2xl relative z-10 select-none">
        <CardHeader className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl border border-border/20 overflow-hidden flex items-center justify-center mb-4">
            <img src="/icon.png" alt="Nirvaha" className="h-full w-full object-cover" />
          </div>
          <CardTitle className="text-3xl font-serif font-medium tracking-wide">
            Nirvaha Console
          </CardTitle>
          <CardDescription className="text-muted-foreground/70 uppercase tracking-widest text-[10px] font-semibold mt-1">
            Internal Operations
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4 mt-2">
            {/* Form Error Notice */}
            {formError && (
              <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-sm flex items-center gap-2.5">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                <span className="font-medium leading-none">{formError}</span>
              </div>
            )}

            {/* Auth Error (e.g. redirected with access denied but session persisted) */}
            {authError && !formError && (
              <div className="p-3.5 rounded-xl border border-destructive/25 bg-destructive/5 text-destructive text-sm flex items-center gap-2.5">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                <span className="font-medium leading-normal">{authError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground/60" />
                <Input
                  type="email"
                  placeholder="admin@nirvaha.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={signingIn}
                  className="pl-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
                Secure Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground/60" />
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={signingIn}
                  className="pl-11"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={signingIn || loading}
              className="w-full h-11 mt-6 text-sm font-semibold tracking-wide"
            >
              {signingIn || loading ? 'Authenticating...' : 'Enter Console'}
            </Button>
          </form>
          
          <div className="mt-8 border-t border-border/10 pt-4 flex flex-col items-center">
            <p className="text-[10px] text-muted-foreground/50 leading-relaxed text-center">
              Secured with Firebase Authentication.
              <br />
              All administrator actions are logged for security audits.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
