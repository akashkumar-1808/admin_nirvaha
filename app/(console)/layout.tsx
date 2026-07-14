'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/sidebar';

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user || !isAdmin) {
        router.replace('/login');
      }
    }
  }, [user, isAdmin, loading, router]);

  // Loading state (organic breathing logo)
  if (loading || !user || !isAdmin) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-background min-h-screen select-none">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl border border-border/30 overflow-hidden relative animate-breathe">
            <img src="/icon.png" alt="Nirvaha" className="h-full w-full object-cover" />
          </div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest leading-none">
            Verifying Admin Session
          </p>
        </div>
      </div>
    );
  }

  // Double check authorization, render workspace
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Permanent Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-gradient-to-br from-background to-[#05110a] relative">
        {/* Top subtle horizontal gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary/30 via-accent/20 to-primary/10 shrink-0" />
        
        {/* Child views */}
        <div className="flex-1 flex flex-col p-8 md:p-10 max-w-6xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
