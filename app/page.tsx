'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function RootPage() {
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user && isAdmin) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isAdmin, loading, router]);

  return (
    <div className="flex-1 flex flex-col justify-center items-center bg-background min-h-screen select-none">
      <div className="flex flex-col items-center gap-4">
        {/* Breathing Logo emblem */}
        <div className="h-16 w-16 rounded-2xl border border-border/30 overflow-hidden relative animate-breathe">
          <img src="/icon.png" alt="Nirvaha" className="h-full w-full object-cover" />
        </div>
        <p className="text-sm text-secondary-foreground font-serif tracking-widest uppercase animate-pulse">
          Nirvaha Console
        </p>
      </div>
    </div>
  );
}
