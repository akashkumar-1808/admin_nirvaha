'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  HelpCircle, 
  Settings as SettingsIcon, 
  KeyRound, 
  Layers, 
  Sliders, 
  Cpu, 
  ShieldAlert
} from 'lucide-react';
import { AVAILABLE_TOPICS } from '@/config/topics';

interface HealthData {
  status: string;
  services: {
    firebaseClient: {
      configured: boolean;
      apiKey: boolean;
      authDomain: boolean;
      projectId: boolean;
    };
    firebaseAdmin: {
      configured: boolean;
      appInitialized: boolean;
      projectId: boolean;
      clientEmail: boolean;
      privateKey: boolean;
    };
    authorization: {
      adminEmailsLoaded: number;
    };
  };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (error) {
      console.error('Error loading settings health:', error);
      toast('Failed to load environment status', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const triggerAudit = () => {
    fetchHealth();
    toast('Security audit completed', 'success');
  };

  return (
    <div className="space-y-8 select-none">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-wide text-foreground/90 leading-tight">
            Console Settings
          </h2>
          <p className="text-secondary-foreground text-sm font-medium mt-1">
            Audit system configurations, verify Firebase integrations, and inspect pre-configured parameters.
          </p>
        </div>
        <Button onClick={triggerAudit} variant="secondary" size="sm" className="h-10 shrink-0">
          <KeyRound className="h-4 w-4 mr-2 text-primary" />
          <span>Rerun Security Audit</span>
        </Button>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Environment secret validation - Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Secrets Audit Card */}
          <Card className="border-border/30">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Environment Secret Audit</CardTitle>
                <CardDescription>Secure check verifying required variables are populated in the hosting server.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Warning about exposing details */}
              <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 text-secondary-foreground text-xs leading-normal flex items-start gap-2.5">
                <ShieldAlert className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                <span>
                  For safety, credentials are never printed. Green indicators confirm that keys are successfully populated in the runtime context and are of valid format.
                </span>
              </div>

              {/* Client keys group */}
              <div className="space-y-3">
                <h4 className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Client-Side Configuration (Public)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl border border-border/10 bg-secondary/5 flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-secondary-foreground">NEXT_PUBLIC_FIREBASE_API_KEY</span>
                    {loading ? (
                      <span className="text-xs text-muted-foreground">Checking...</span>
                    ) : health?.services?.firebaseClient?.apiKey ? (
                      <span className="flex items-center text-xs font-semibold text-primary gap-1"><CheckCircle className="h-4 w-4" /> Set</span>
                    ) : (
                      <span className="flex items-center text-xs font-semibold text-destructive gap-1"><XCircle className="h-4 w-4" /> Missing</span>
                    )}
                  </div>

                  <div className="p-3 rounded-xl border border-border/10 bg-secondary/5 flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-secondary-foreground">NEXT_PUBLIC_FIREBASE_PROJECT_ID</span>
                    {loading ? (
                      <span className="text-xs text-muted-foreground">Checking...</span>
                    ) : health?.services?.firebaseClient?.projectId ? (
                      <span className="flex items-center text-xs font-semibold text-primary gap-1"><CheckCircle className="h-4 w-4" /> Set</span>
                    ) : (
                      <span className="flex items-center text-xs font-semibold text-destructive gap-1"><XCircle className="h-4 w-4" /> Missing</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Server keys group */}
              <div className="space-y-3 border-t border-border/10 pt-5">
                <h4 className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Server-Side Configuration (Secrets)</h4>
                
                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-xl border border-border/10 bg-secondary/5 flex items-center justify-between text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs text-foreground/80">FIREBASE_PROJECT_ID</span>
                      <span className="text-[10px] text-muted-foreground">Matches client project ID</span>
                    </div>
                    {loading ? (
                      <span className="text-xs text-muted-foreground">Checking...</span>
                    ) : health?.services?.firebaseAdmin?.projectId ? (
                      <span className="flex items-center text-xs font-semibold text-primary gap-1"><CheckCircle className="h-4 w-4" /> Configured</span>
                    ) : (
                      <span className="flex items-center text-xs font-semibold text-destructive gap-1"><XCircle className="h-4 w-4" /> Missing</span>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl border border-border/10 bg-secondary/5 flex items-center justify-between text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs text-foreground/80">FIREBASE_CLIENT_EMAIL</span>
                      <span className="text-[10px] text-muted-foreground">Service account identity email</span>
                    </div>
                    {loading ? (
                      <span className="text-xs text-muted-foreground">Checking...</span>
                    ) : health?.services?.firebaseAdmin?.clientEmail ? (
                      <span className="flex items-center text-xs font-semibold text-primary gap-1"><CheckCircle className="h-4 w-4" /> Configured</span>
                    ) : (
                      <span className="flex items-center text-xs font-semibold text-destructive gap-1"><XCircle className="h-4 w-4" /> Missing</span>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl border border-border/10 bg-secondary/5 flex items-center justify-between text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs text-foreground/80">FIREBASE_PRIVATE_KEY</span>
                      <span className="text-[10px] text-muted-foreground">RSA private key from service account JSON</span>
                    </div>
                    {loading ? (
                      <span className="text-xs text-muted-foreground">Checking...</span>
                    ) : health?.services?.firebaseAdmin?.privateKey ? (
                      <span className="flex items-center text-xs font-semibold text-primary gap-1"><CheckCircle className="h-4 w-4" /> Configured</span>
                    ) : (
                      <span className="flex items-center text-xs font-semibold text-destructive gap-1"><XCircle className="h-4 w-4" /> Missing</span>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl border border-border/10 bg-secondary/5 flex items-center justify-between text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs text-foreground/80">AUTHORIZED_ADMIN_EMAILS</span>
                      <span className="text-[10px] text-muted-foreground">Emails list for permission checks</span>
                    </div>
                    {loading ? (
                      <span className="text-xs text-muted-foreground">Checking...</span>
                    ) : (health?.services?.authorization?.adminEmailsLoaded || 0) > 0 ? (
                      <span className="flex items-center text-xs font-semibold text-primary gap-1">
                        <CheckCircle className="h-4 w-4" /> {health?.services?.authorization?.adminEmailsLoaded} loaded
                      </span>
                    ) : (
                      <span className="flex items-center text-xs font-semibold text-destructive gap-1"><XCircle className="h-4 w-4" /> 0 Loaded</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Centralized Topics List Card */}
          <Card className="border-border/30">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Preconfigured Topics</CardTitle>
                <CardDescription>Broadcast destinations mapped to mobile application handlers.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border border-border/25 rounded-xl overflow-hidden bg-black/10">
                <div className="grid grid-cols-3 bg-secondary/20 p-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider border-b border-border/15">
                  <div>Topic Identifier</div>
                  <div>Friendly Name</div>
                  <div>Target Group</div>
                </div>
                <div className="divide-y divide-border/10">
                  {AVAILABLE_TOPICS.map((topic) => (
                    <div key={topic.id} className="grid grid-cols-3 p-3 text-sm text-foreground/80 font-medium">
                      <div className="font-mono text-xs text-primary">{topic.id}</div>
                      <div>{topic.name}</div>
                      <div className="text-xs text-muted-foreground/90 leading-relaxed">{topic.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Configurations side column */}
        <div className="space-y-6">
          {/* Notification Defaults */}
          <Card className="border-border/30">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <Sliders className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base">Composer Defaults</CardTitle>
                <CardDescription>Default notification settings.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-secondary-foreground leading-relaxed">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sound Profile</p>
                <p className="text-foreground/85 font-medium">default (device setting)</p>
              </div>
              
              <div className="space-y-0.5 border-t border-border/10 pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Android Channel ID</p>
                <p className="text-foreground/85 font-mono text-xs">nirvaha_general_broadcast</p>
              </div>

              <div className="space-y-0.5 border-t border-border/10 pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">iOS Payload Badge</p>
                <p className="text-foreground/85 font-medium">Auto-increment (+1)</p>
              </div>

              <div className="space-y-0.5 border-t border-border/10 pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time-to-Live (TTL)</p>
                <p className="text-foreground/85 font-medium">24 Hours (86,400s)</p>
              </div>
            </CardContent>
          </Card>

          {/* System information */}
          <Card className="border-border/30">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <Cpu className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base">System Details</CardTitle>
                <CardDescription>Build environment specs.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3.5 text-sm text-secondary-foreground">
              <div className="flex justify-between py-0.5 border-b border-border/5">
                <span className="text-muted-foreground">Framework</span>
                <span className="font-semibold text-foreground/90">Next.js 15.0</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-border/5">
                <span className="text-muted-foreground">Deployment</span>
                <span className="font-semibold text-foreground/90">Vercel Edge</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Current admin</span>
                <span className="font-semibold text-foreground/90 truncate max-w-[130px]">{user?.email}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
