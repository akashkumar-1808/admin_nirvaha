'use client';

import React, { useState, useCallback } from 'react';
import NotificationComposer from '@/components/notifications/composer';
import NotificationPreview from '@/components/notifications/preview';
import NotificationHistory from '@/components/notifications/history';
import { Card, CardContent } from '@/components/ui/card';
import { BellRing, ShieldCheck, Compass } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NotificationsPage() {
  const [composerState, setComposerState] = useState({
    title: '',
    body: '',
    imageUrl: '',
    topic: 'all_users',
    priority: 'normal' as 'normal' | 'high',
    deepLink: '',
  });

  // Force-render reload callback if needed when notification succeeds
  const [historyKey, setHistoryKey] = useState(0);
  const handleSentSuccess = useCallback(() => {
    setHistoryKey((prev) => prev + 1);
  }, []);

  const handleComposerStateChange = useCallback((state: typeof composerState) => {
    setComposerState(state);
  }, []);

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div>
        <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-wide text-foreground/90 leading-tight">
          Push Notification Composer
        </h2>
        <p className="text-secondary-foreground text-sm font-medium mt-1">
          Compose message payloads, preview Android rendering, and dispatch secure Firebase Topic broadcasts.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column: Composer Form (2 cols) */}
        <div className="lg:col-span-2">
          <NotificationComposer 
            onStateChange={handleComposerStateChange}
            onSentSuccess={handleSentSuccess}
          />
        </div>

        {/* Right Column: Live Android Preview (1 col) */}
        <div className="space-y-6">
          <Card className="border-border/30 bg-black/10 p-5">
            <CardContent className="p-0 pt-1">
              <NotificationPreview
                title={composerState.title}
                body={composerState.body}
                imageUrl={composerState.imageUrl}
                priority={composerState.priority}
                deepLink={composerState.deepLink}
              />
            </CardContent>
          </Card>

          {/* Quick instructions box */}
          <div className="p-4 rounded-xl border border-border/20 bg-secondary/5 text-xs text-secondary-foreground leading-relaxed flex items-start gap-2.5">
            <Compass className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-foreground/90 block mb-0.5">Topic Broadcast Protocol</span>
              Nirvaha uses topic-based messaging exclusively. Devices subscribe to topics (e.g. <code>meditation</code>) during onboarding. Sending a notification to that topic delivers it to all subscribers without manual token lists.
            </div>
          </div>
        </div>

      </div>

      {/* Full width bottom section: History logs */}
      <div className="pt-4">
        <NotificationHistory key={historyKey} />
      </div>
    </div>
  );
}
