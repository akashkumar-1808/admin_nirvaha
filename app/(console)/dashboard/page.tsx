'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ShieldCheck, 
  Server, 
  Radio, 
  User, 
  Send, 
  Settings as SettingsIcon, 
  Layers, 
  Sparkles,
  TrendingUp,
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AVAILABLE_TOPICS } from '@/config/topics';
import { cn } from '@/utils/cn';

interface HealthData {
  status: string;
  services: {
    firebaseClient: { configured: boolean };
    firebaseAdmin: { configured: boolean; appInitialized: boolean };
    authorization: { adminEmailsLoaded: number };
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [recentLogs, setRecentLogs] = useState<Array<{ id: string; text: string; time: string; type: 'auth' | 'system' | 'notif' }>>([]);

  const fetchHealth = async () => {
    try {
      setLoadingHealth(true);
      const res = await fetch('/api/health');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setHealth(data);
        }
      }
    } catch (error) {
      console.error('Error fetching system health:', error);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    
    // Set up mock recent activity log
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setRecentLogs([
      { id: '1', text: 'Firebase Client SDK initialized', time: '10 min ago', type: 'system' },
      { id: '2', text: `Admin session verified for ${user?.email}`, time: 'Just now', type: 'auth' },
    ]);
  }, [user]);

  // Read notifications sent count today (reads from local storage keys)
  const [sentCount, setSentCount] = useState(0);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCount = localStorage.getItem('nirvaha_sent_today_count');
      setSentCount(storedCount ? parseInt(storedCount) : 0);
    }
  }, []);

  const triggerHealthToast = () => {
    fetchHealth();
    toast('System status verified', 'success');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
  } as const;

  return (
    <div className="space-y-8 select-none">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-wide text-foreground/90 leading-tight">
            Welcome, Administrator
          </h2>
          <p className="text-secondary-foreground text-sm font-medium mt-1">
            Official admin cockpit for the Nirvaha ecosystem. Keep systems steady and users informed.
          </p>
        </div>
        <Button onClick={triggerHealthToast} variant="secondary" size="sm" className="h-10 shrink-0">
          <Activity className="h-4 w-4 mr-2 text-primary" />
          <span>Refresh System Health</span>
        </Button>
      </div>

      {/* Grid of Metric Cards */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {/* Firebase Status */}
        <motion.div variants={itemVariants}>
          <Card className="border-border/30 hover:border-primary/30 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Firebase client</span>
              <div className={`p-1.5 rounded-lg border ${
                health?.services?.firebaseClient?.configured 
                  ? 'bg-primary/10 border-primary/20 text-primary' 
                  : loadingHealth 
                    ? 'bg-secondary/20 border-border/10 text-muted-foreground' 
                    : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}>
                <Server className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-serif font-medium tracking-wide mt-1">
                {loadingHealth ? 'Checking...' : health?.services?.firebaseClient?.configured ? 'Connected' : 'Offline'}
              </div>
              <p className="text-xs text-muted-foreground mt-1 select-none">
                Client authorization & auth listeners
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Cloud Messaging Status */}
        <motion.div variants={itemVariants}>
          <Card className="border-border/30 hover:border-primary/30 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Cloud Messaging</span>
              <div className={`p-1.5 rounded-lg border ${
                health?.services?.firebaseAdmin?.appInitialized 
                  ? 'bg-primary/10 border-primary/20 text-primary' 
                  : loadingHealth 
                    ? 'bg-secondary/20 border-border/10 text-muted-foreground' 
                    : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}>
                <Radio className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-serif font-medium tracking-wide mt-1">
                {loadingHealth ? 'Checking...' : health?.services?.firebaseAdmin?.appInitialized ? 'Active' : 'Not Loaded'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Firebase Admin SDK FCM services
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications Sent Today */}
        <motion.div variants={itemVariants}>
          <Card className="border-border/30 hover:border-primary/30 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Sent Today</span>
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-serif font-medium tracking-wide mt-1">
                {sentCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Topic pushes broadcasted today
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Available Topics */}
        <motion.div variants={itemVariants}>
          <Card className="border-border/30 hover:border-primary/30 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Available Topics</span>
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                <Layers className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-serif font-medium tracking-wide mt-1">
                {AVAILABLE_TOPICS.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pre-configured target segments
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main split sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Double Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions Card */}
          <Card className="border-border/30">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Direct shortcuts to operate Nirvaha Console modules.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/notifications" className="block">
                <div className="p-4 rounded-xl border border-border/20 bg-secondary/10 hover:bg-primary/5 hover:border-primary/30 hover:shadow-sm transition-all duration-200 group flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Send className="h-5 w-5 group-hover:scale-105 transition-transform" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground/90 leading-tight">Send push notification</h4>
                    <p className="text-xs text-muted-foreground leading-normal mt-1">
                      Compose title, body, and issue a topic broadcast immediately.
                    </p>
                  </div>
                </div>
              </Link>

              <Link href="/settings" className="block">
                <div className="p-4 rounded-xl border border-border/20 bg-secondary/10 hover:bg-primary/5 hover:border-primary/30 hover:shadow-sm transition-all duration-200 group flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                    <SettingsIcon className="h-5 w-5 group-hover:rotate-45 transition-transform duration-300" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground/90 leading-tight">Configure credentials</h4>
                    <p className="text-xs text-muted-foreground leading-normal mt-1">
                      Check system environment variables, default behaviors, and topics.
                    </p>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Activity Log */}
          <Card className="border-border/30">
            <CardHeader>
              <CardTitle className="text-lg">Recent Console Activity</CardTitle>
              <CardDescription>Audit logs of actions performed in this admin session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex justify-between items-center gap-4 py-2 border-b border-border/10 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className={cn('h-2 w-2 rounded-full', {
                      'bg-primary': log.type === 'system',
                      'bg-accent': log.type === 'auth',
                      'bg-indigo-500': log.type === 'notif',
                    })} />
                    <span className="text-sm text-foreground/80 font-medium">{log.text}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 shrink-0">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{log.time}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Single Column (Health Status detail and V2 Modules) */}
        <div className="space-y-6">
          {/* Detailed System Health Widget */}
          <Card className="border-border/30 bg-black/10">
            <CardHeader>
              <CardTitle className="text-lg">Environment Status</CardTitle>
              <CardDescription>Server variables audit checklist.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <div className="flex items-center justify-between py-1 text-sm">
                <span className="text-secondary-foreground">Admin Config status</span>
                {health?.services?.firebaseAdmin?.configured ? (
                  <span className="flex items-center text-xs font-semibold text-primary gap-1">
                    <CheckCircle className="h-4 w-4" /> Ready
                  </span>
                ) : (
                  <span className="flex items-center text-xs font-semibold text-destructive gap-1">
                    <AlertTriangle className="h-4 w-4" /> Config Missing
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between py-1 text-sm">
                <span className="text-secondary-foreground">Admin app initialization</span>
                {health?.services?.firebaseAdmin?.appInitialized ? (
                  <span className="flex items-center text-xs font-semibold text-primary gap-1">
                    <CheckCircle className="h-4 w-4" /> Active
                  </span>
                ) : (
                  <span className="flex items-center text-xs font-semibold text-destructive gap-1">
                    <AlertTriangle className="h-4 w-4" /> Missing
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between py-1 text-sm">
                <span className="text-secondary-foreground">Authorized Admins Count</span>
                <span className="text-xs font-semibold text-foreground bg-secondary px-2.5 py-0.5 rounded-full border border-border/25">
                  {loadingHealth ? 'Checking...' : `${health?.services?.authorization?.adminEmailsLoaded || 0} Emails`}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Roadmap Card */}
          <Card className="border-border/30 overflow-hidden relative">
            <div className="absolute -bottom-10 -left-10 h-28 w-28 bg-accent/5 rounded-full blur-2xl pointer-events-none" />
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5 text-accent" />
                <span>Modular Expansion</span>
              </CardTitle>
              <CardDescription>Future administrative dashboards planned in V2.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2.5 text-sm text-secondary-foreground select-none">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span>Healing Music & Media Library</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-secondary-foreground select-none">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span>Companion Personality Adjuster</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-secondary-foreground select-none">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span>AI Wisdom & Prompt Library</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-secondary-foreground select-none">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span>Feature Flags & Beta Toggles</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
