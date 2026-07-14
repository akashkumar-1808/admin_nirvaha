'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Clock, Database, BarChart3, Lock } from 'lucide-react';

export const NotificationHistory: React.FC = () => {
  return (
    <Card className="border-border/30 bg-black/10 select-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <span>Notification History & Audit</span>
        </CardTitle>
        <CardDescription>Real-time delivery status logs and metric CTR reports.</CardDescription>
      </CardHeader>
      
      <CardContent className="py-8 px-6 text-center flex flex-col items-center">
        {/* Visual stack representing databases and metrics locked behind a lock */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-xl bg-secondary/35 border border-border/20 flex items-center justify-center text-muted-foreground/60 shrink-0">
            <Database className="h-5.5 w-5.5" />
          </div>
          <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary relative shadow-md shrink-0">
            <BarChart3 className="h-6 w-6" />
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-secondary border border-border/40 text-accent flex items-center justify-center shadow-md">
              <Lock className="h-3 w-3" />
            </div>
          </div>
          <div className="h-12 w-12 rounded-xl bg-secondary/35 border border-border/20 flex items-center justify-center text-muted-foreground/60 shrink-0">
            <Clock className="h-5.5 w-5.5" />
          </div>
        </div>

        <span className="text-[9px] font-bold uppercase tracking-widest bg-[#2d5a4c]/20 border border-[#2d5a4c]/40 text-primary px-2.5 py-0.5 rounded-full mb-3">
          Version 2.0 Feature
        </span>

        <h3 className="text-base font-semibold text-foreground/90 leading-tight mb-2">
          Database Integration Planned for V2
        </h3>
        
        <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
          To maintain Nirvaha's lightweight operations dashboard structure, direct Firestore/database history integration has been deferred. When V2 launches, sent records will sync automatically to support filters, status tracking (delivered vs failed), and telemetry CTR analysis.
        </p>
      </CardContent>
    </Card>
  );
};

export default NotificationHistory;
