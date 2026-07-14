'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/toast';
import {
  LayoutDashboard,
  BellRing,
  BarChart3,
  Users,
  Music,
  FolderHeart,
  BrainCircuit,
  Flag,
  MessageSquare,
  Settings,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Notifications', href: '/notifications', icon: BellRing },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, comingSoon: true },
  { name: 'Companions', href: '/companions', icon: Users, comingSoon: true },
  { name: 'Healing Content', href: '/healing', icon: Music, comingSoon: true },
  { name: 'Collections', href: '/collections', icon: FolderHeart, comingSoon: true },
  { name: 'AI', href: '/ai', icon: BrainCircuit, comingSoon: true },
  { name: 'Feature Flags', href: '/feature-flags', icon: Flag, comingSoon: true },
  { name: 'Feedback', href: '/feedback', icon: MessageSquare, comingSoon: true },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast('Logged out successfully', 'success');
      router.push('/login');
    } catch (err: any) {
      toast(err.message || 'Logout failed', 'error');
    }
  };

  return (
    <aside className="w-72 h-screen border-r border-border/40 bg-card/60 backdrop-blur-md flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-border/10 flex items-center gap-3">
          {/* Brand Logo Image */}
          <div className="h-10 w-10 rounded-xl border border-border/20 overflow-hidden flex items-center justify-center shrink-0">
            <img src="/icon.png" alt="Nirvaha" className="h-full w-full object-cover" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-semibold tracking-wide text-foreground/90 leading-tight">
              Nirvaha Console
            </h1>
            <p className="text-xs text-secondary-foreground font-medium uppercase tracking-widest leading-none mt-0.5">
              Internal Operations
            </p>
          </div>
        </div>

        {/* Navigation Modules */}
        <nav className="p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            if (item.comingSoon) {
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-4 py-3 rounded-xl text-muted-foreground/45 border border-transparent select-none cursor-not-allowed group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-secondary/15 px-2 py-0.5 rounded-md text-muted-foreground/35 group-hover:text-primary/50 group-hover:bg-primary/5 transition-colors">
                    Soon
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border',
                  isActive
                    ? 'bg-primary/10 border-primary/20 text-primary shadow-[0_2px_8px_rgba(45,90,76,0.08)]'
                    : 'border-transparent text-secondary-foreground hover:bg-secondary/20 hover:text-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-primary' : 'text-secondary-foreground')} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Admin Quick Profile & Logout */}
      <div className="p-4 border-t border-border/10 bg-black/10">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center border border-border/20 text-secondary-foreground">
            <UserCheck className="h-5 w-5" />
          </div>
          <div className="overflow-hidden">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Signed In Admin</p>
            <p className="text-sm font-medium text-foreground/90 truncate mt-0.5">
              {user?.email || 'System Administrator'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 h-10 px-4 rounded-xl border border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive hover:text-white transition-all duration-200 text-sm font-medium"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
