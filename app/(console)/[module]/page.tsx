'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Compass, Sparkles, BarChart, Settings, Users, Music, Folder, Flag, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Helper to map route slugs to icons and friendly names
const MODULE_METADATA: Record<string, { name: string; icon: React.ComponentType<any>; desc: string }> = {
  analytics: {
    name: 'Analytics & Insights',
    icon: BarChart,
    desc: 'Real-time telemetry, notification click-through rates, and daily active user engagement logs.',
  },
  companions: {
    name: 'Companion Manager',
    icon: Users,
    desc: 'Verify guide avatars, configure guide personalities, toggle companion availability, and read chat logs.',
  },
  healing: {
    name: 'Healing Content Library',
    icon: Music,
    desc: 'Upload new binaural beats, sound baths, meditation audio files, and manage their categorizations.',
  },
  collections: {
    name: 'Healing Collections',
    icon: Folder,
    desc: 'Create and order content groupings, playlists, and thematic programs for mental rest.',
  },
  ai: {
    name: 'AI Prompt Library',
    icon: Sparkles,
    desc: 'Update system prompts for companions, test behavioral changes, and adjust temperature parameters.',
  },
  'feature-flags': {
    name: 'Feature Flags & Experiments',
    icon: Flag,
    desc: 'Remotely toggle beta modules, manage app layout variations, and target cohorts without code deploys.',
  },
  feedback: {
    name: 'User Feedback & Reports',
    icon: MessageSquare,
    desc: 'Review submitted reports, support requests, bug submissions, and application feedback.',
  },
};

export default function ComingSoonModule() {
  const params = useParams();
  const moduleSlug = params?.module as string;
  
  const metadata = MODULE_METADATA[moduleSlug] || {
    name: moduleSlug ? moduleSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Console Module',
    icon: Compass,
    desc: 'Advanced operations and content administration tools are planned for this module.',
  };

  const Icon = metadata.icon;

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-8 select-none">
      <Card className="max-w-xl w-full border-border/30 bg-card/40 backdrop-blur-sm relative overflow-hidden py-8 px-6">
        {/* Organic background glow */}
        <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-primary/10 blur-3xl pointer-events-none animate-breathe" />
        
        <CardContent className="flex flex-col items-center text-center p-6">
          <div className="h-16 w-16 rounded-2xl bg-secondary/35 border border-border/20 flex items-center justify-center text-primary mb-6 shadow-[0_4px_20px_rgba(45,90,76,0.05)]">
            <Icon className="h-8 w-8" />
          </div>

          <span className="text-[10px] font-semibold uppercase tracking-widest bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full mb-3">
            Console Module V2
          </span>

          <h2 className="font-serif text-3xl font-medium text-foreground/90 tracking-wide mb-3">
            {metadata.name}
          </h2>
          
          <p className="text-secondary-foreground text-base max-w-md leading-relaxed mb-8">
            {metadata.desc}
          </p>

          <div className="w-full border-t border-border/10 pt-6">
            <p className="text-xs text-muted-foreground/60">
              Future internal operations modules plug in seamlessly. 
              <br />
              Layout grids, route patterns, and design system tokens are already active.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
