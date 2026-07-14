'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/dialogs/confirm';
import { AVAILABLE_TOPICS } from '@/config/topics';
import { Send, Eye, Radio, ShieldAlert, Sparkles, Link as LinkIcon, Compass, CheckCircle } from 'lucide-react';

const DEEP_LINK_SHORTCUTS = [
  { label: 'Music Screen', value: 'nirvaha://music' },
  { label: 'Sleep Screen', value: 'nirvaha://sleep' },
  { label: 'AI Companion', value: 'nirvaha://ai' },
  { label: 'Guides Chat', value: 'nirvaha://companions' },
];

interface ComposerProps {
  onStateChange: (state: {
    title: string;
    body: string;
    imageUrl: string;
    topic: string;
    priority: 'normal' | 'high';
    deepLink: string;
  }) => void;
  onSentSuccess: () => void;
}

export const NotificationComposer: React.FC<ComposerProps> = ({
  onStateChange,
  onSentSuccess,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Form Fields
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [topic, setTopic] = useState('all_users');
  const [customTopic, setCustomTopic] = useState('');
  const [useCustomTopic, setUseCustomTopic] = useState(false);
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [deepLink, setDeepLink] = useState('');

  // UI state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [targetPayload, setTargetPayload] = useState<any>(null);

  // Cooldown State
  const [cooldown, setCooldown] = useState(0);

  // Character Limits
  const TITLE_LIMIT = 65;
  const BODY_LIMIT = 240;

  // Propagate state changes to parent (for Live Preview)
  useEffect(() => {
    onStateChange({
      title,
      body,
      imageUrl,
      topic: useCustomTopic ? customTopic : topic,
      priority,
      deepLink,
    });
  }, [title, body, imageUrl, topic, customTopic, useCustomTopic, priority, deepLink, onStateChange]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleShortcutClick = (link: string) => {
    setDeepLink(link);
    toast(`Appended link: ${link}`, 'info');
  };

  const handleTopicSelectChange = (value: string) => {
    if (value === 'custom') {
      setUseCustomTopic(true);
    } else {
      setUseCustomTopic(false);
      setTopic(value);
    }
  };

  // Submit Handler
  const handleTriggerSend = (type: 'broadcast' | 'test') => {
    const finalTopic = type === 'test' 
      ? `admin_uid_${user?.uid}` 
      : (useCustomTopic ? customTopic.trim() : topic);

    if (type === 'broadcast' && !useCustomTopic && !topic) {
      toast('Please select a target topic.', 'error');
      return;
    }

    if (type === 'broadcast' && useCustomTopic && !customTopic.trim()) {
      toast('Please specify a custom topic identifier.', 'error');
      return;
    }

    if (!title.trim() || !body.trim()) {
      toast('Title and Body are required fields.', 'error');
      return;
    }

    const payload = {
      title: title.trim(),
      body: body.trim(),
      imageUrl: imageUrl.trim(),
      topic: finalTopic,
      priority,
      deepLink: deepLink.trim(),
    };

    setTargetPayload(payload);
    setIsConfirmOpen(true);
  };

  const executeSend = async () => {
    if (!targetPayload || !user) return;
    setSending(true);

    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(targetPayload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast('Notification dispatched successfully!', 'success');
        
        // Save history audit log in page & local storage counter
        if (typeof window !== 'undefined') {
          const storedCount = localStorage.getItem('nirvaha_sent_today_count');
          localStorage.setItem('nirvaha_sent_today_count', String((storedCount ? parseInt(storedCount) : 0) + 1));
          
          // Save sent log in session for visual feedback
          const currentHistoryStr = localStorage.getItem('nirvaha_sent_log') || '[]';
          const historyList = JSON.parse(currentHistoryStr);
          historyList.unshift({
            id: data.messageId || Math.random().toString(36).substring(2, 9),
            title: targetPayload.title,
            body: targetPayload.body,
            topic: targetPayload.topic,
            sentAt: new Date().toISOString(),
            status: 'sent',
          });
          localStorage.setItem('nirvaha_sent_log', JSON.stringify(historyList));
        }

        // Start 5 second send cooldown
        setCooldown(5);

        // Reset composer form fields
        setTitle('');
        setBody('');
        setImageUrl('');
        setDeepLink('');
        setUseCustomTopic(false);
        setTopic('all_users');
        setCustomTopic('');
        
        // Trigger success parent refresh callback
        onSentSuccess();
      } else {
        throw new Error(data.error || 'Failed to dispatch FCM message');
      }
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Transmission failed', 'error');
    } finally {
      setSending(false);
      setIsConfirmOpen(false);
    }
  };

  // Convert topic options for our Select primitive
  const selectOptions = [
    ...AVAILABLE_TOPICS.map((t) => ({
      value: t.id,
      label: t.name,
      description: t.description,
    })),
    { value: 'custom', label: '➕ Custom Topic...', description: 'Specify a custom FCM topic identifier' },
  ];

  return (
    <Card className="border-border/30">
      <CardHeader>
        <CardTitle className="text-lg">Notification Composer</CardTitle>
        <CardDescription>Target segments and design message payloads.</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Cooldown Alert */}
        {cooldown > 0 && (
          <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 text-primary text-xs font-medium flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5 animate-pulse" />
            <span>Anti-duplicate cooldown active. Wait {cooldown}s before sending another alert.</span>
          </div>
        )}

        {/* Topic Selector */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
            Target Destination
          </label>
          <Select
            options={selectOptions}
            value={useCustomTopic ? 'custom' : topic}
            onChange={handleTopicSelectChange}
            placeholder="Select a subscriber topic"
          />

          {/* Custom Topic text field if checked */}
          {useCustomTopic && (
            <div className="mt-2.5 space-y-1">
              <Input
                type="text"
                placeholder="Type topic slug (e.g. newsletter_updates)"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value.replace(/[^a-zA-Z0-9-_.~%]/g, ''))}
                className="font-mono text-sm"
              />
              <span className="text-[10px] text-muted-foreground/60 leading-none">
                Supports letters, numbers, dashes, underscores, and dots.
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
              Notification Title
            </label>
            <span className={`text-[10px] font-semibold ${
              title.length > TITLE_LIMIT ? 'text-destructive' : 'text-muted-foreground/60'
            }`}>
              {title.length} / {TITLE_LIMIT} chars
            </span>
          </div>
          <Input
            type="text"
            placeholder="Enter bold title header"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, TITLE_LIMIT + 10))}
            className={title.length > TITLE_LIMIT ? 'border-destructive/50 focus-visible:ring-destructive' : ''}
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
              Notification Body text
            </label>
            <span className={`text-[10px] font-semibold ${
              body.length > BODY_LIMIT ? 'text-destructive' : 'text-muted-foreground/60'
            }`}>
              {body.length} / {BODY_LIMIT} chars
            </span>
          </div>
          <Textarea
            placeholder="Write detail text. Keep it short and peaceful..."
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, BODY_LIMIT + 20))}
            className={body.length > BODY_LIMIT ? 'border-destructive/50 focus-visible:ring-destructive' : ''}
          />
        </div>

        {/* Image URL */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
            Optional Image URL
          </label>
          <Input
            type="url"
            placeholder="https://images.unsplash.com/photo-..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>

        {/* Priority & Deep Link Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/10 pt-4">
          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
              FCM Priority
            </label>
            <div className="flex bg-input border border-border/40 rounded-xl p-1 text-sm font-medium gap-1.5">
              <button
                type="button"
                onClick={() => setPriority('normal')}
                className={`flex-1 text-center py-1.5 rounded-lg transition-colors ${
                  priority === 'normal' 
                    ? 'bg-primary text-white shadow-sm' 
                    : 'text-muted-foreground/75 hover:bg-secondary/45 hover:text-foreground'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setPriority('high')}
                className={`flex-1 text-center py-1.5 rounded-lg transition-colors ${
                  priority === 'high' 
                    ? 'bg-destructive text-white shadow-sm' 
                    : 'text-muted-foreground/75 hover:bg-secondary/45 hover:text-foreground'
                }`}
              >
                High
              </button>
            </div>
          </div>

          {/* Deep link */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
              Optional Intent Deep Link
            </label>
            <Input
              type="text"
              placeholder="nirvaha://..."
              value={deepLink}
              onChange={(e) => setDeepLink(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>

        {/* Deep Link Shortcuts */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-semibold block">
            Deep Link Shortcuts
          </span>
          <div className="flex flex-wrap gap-2 pt-1">
            {DEEP_LINK_SHORTCUTS.map((shortcut) => (
              <button
                key={shortcut.value}
                type="button"
                onClick={() => handleShortcutClick(shortcut.value)}
                className="text-[11px] font-semibold bg-secondary/15 hover:bg-primary/10 border border-border/20 hover:border-primary/30 text-secondary-foreground hover:text-primary px-2.5 py-1 rounded-lg transition-all"
              >
                {shortcut.label}
              </button>
            ))}
          </div>
        </div>

        {/* Composer Actions */}
        <div className="flex flex-col sm:flex-row gap-3 border-t border-border/10 pt-5 mt-6">
          <Button
            type="button"
            onClick={() => handleTriggerSend('test')}
            disabled={cooldown > 0 || sending || !title.trim() || !body.trim()}
            variant="secondary"
            className="flex-1 h-11 text-sm font-semibold"
          >
            <Compass className="h-4 w-4 mr-2" />
            <span>Send Test to Me</span>
          </Button>

          <Button
            type="button"
            onClick={() => handleTriggerSend('broadcast')}
            disabled={cooldown > 0 || sending || !title.trim() || !body.trim() || title.length > TITLE_LIMIT || body.length > BODY_LIMIT}
            className="flex-1 h-11 text-sm font-semibold"
          >
            <Send className="h-4 w-4 mr-2" />
            <span>Send Broadcast</span>
          </Button>
        </div>
      </CardContent>

      {/* Confirmation Overlay Modal */}
      {isConfirmOpen && targetPayload && (
        <ConfirmDialog
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={executeSend}
          payload={targetPayload}
          sending={sending}
        />
      )}
    </Card>
  );
};

export default NotificationComposer;
