'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AVAILABLE_TOPICS } from '@/config/topics';
import { AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  payload: {
    title: string;
    body: string;
    imageUrl: string;
    topic: string;
    priority: string;
    deepLink: string;
  };
  sending: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  payload,
  sending,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [standardCheck, setStandardCheck] = useState(false);

  // Reset inputs when opened/closed
  useEffect(() => {
    if (!isOpen) {
      setConfirmText('');
      setStandardCheck(false);
    }
  }, [isOpen]);

  const isBroadcast = payload.topic === 'all_users';
  
  const getFriendlyTopicName = (topicId: string) => {
    if (topicId.startsWith('admin_uid_')) {
      return `Admin Private Test (${topicId.replace('admin_uid_', '')})`;
    }
    const match = AVAILABLE_TOPICS.find((t) => t.id === topicId);
    return match ? match.name : topicId;
  };

  // Button disabled state verification
  const canSend = isBroadcast
    ? confirmText.trim().toUpperCase() === 'BROADCAST'
    : standardCheck;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={isBroadcast ? 'Confirm Ecosystem Broadcast' : 'Confirm Send Notification'}>
      <div className="space-y-6">
        
        {/* Warning card for general broadcast */}
        {isBroadcast ? (
          <div className="p-4 rounded-xl border border-red-900/40 bg-red-950/15 text-red-300 text-sm leading-relaxed flex items-start gap-3">
            <AlertTriangle className="h-5.5 w-5.5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="font-bold uppercase tracking-wider block mb-1 text-red-200">Critical Ecosystem Broadcast</span>
              You are about to broadcast this notification immediately to <span className="font-semibold text-white underline">ALL registered devices</span> in the production ecosystem. This action will trigger phone screens worldwide. Please verify content for spelling, grammar, and deep links.
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-secondary-foreground text-sm leading-relaxed flex items-start gap-3">
            <ShieldCheck className="h-5.5 w-5.5 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground/95 block mb-1">Target Segment Message</span>
              You are targeting the specific group <span className="font-semibold text-primary">{getFriendlyTopicName(payload.topic)}</span>. Only users subscribed to this specific topic will receive the alert.
            </div>
          </div>
        )}

        {/* Payload details breakdown */}
        <div className="border border-border/20 rounded-xl bg-black/10 overflow-hidden text-sm">
          <div className="grid grid-cols-3 p-3 border-b border-border/5">
            <span className="text-muted-foreground font-medium">Topic Channel</span>
            <span className="col-span-2 font-semibold text-foreground/90 font-mono text-xs">{payload.topic}</span>
          </div>
          <div className="grid grid-cols-3 p-3 border-b border-border/5">
            <span className="text-muted-foreground font-medium">Message Priority</span>
            <span className="col-span-2 font-semibold text-foreground/90 capitalize">{payload.priority}</span>
          </div>
          {payload.deepLink && (
            <div className="grid grid-cols-3 p-3 border-b border-border/5">
              <span className="text-muted-foreground font-medium">Deep Link Url</span>
              <span className="col-span-2 font-mono text-xs text-primary truncate">{payload.deepLink}</span>
            </div>
          )}
          {payload.imageUrl && (
            <div className="grid grid-cols-3 p-3 border-b border-border/5">
              <span className="text-muted-foreground font-medium">Image Banner</span>
              <span className="col-span-2 text-xs truncate text-muted-foreground">{payload.imageUrl}</span>
            </div>
          )}
          <div className="grid grid-cols-3 p-3 items-start">
            <span className="text-muted-foreground font-medium">Content Preview</span>
            <div className="col-span-2 space-y-1">
              <p className="font-semibold text-foreground/95">{payload.title || '(No Title)'}</p>
              <p className="text-xs text-muted-foreground leading-normal line-clamp-2">{payload.body || '(No Body)'}</p>
            </div>
          </div>
        </div>

        {/* Verification check input fields */}
        {isBroadcast ? (
          <div className="space-y-2 border-t border-border/10 pt-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Type <span className="font-bold text-red-400">BROADCAST</span> to confirm
            </label>
            <Input
              type="text"
              placeholder="BROADCAST"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={sending}
              className="text-center font-bold tracking-widest text-red-200 border-red-900/30 bg-red-950/5 focus-visible:ring-red-500 focus-visible:border-red-500"
            />
          </div>
        ) : (
          <div className="flex items-start gap-3 border-t border-border/10 pt-4 select-none cursor-pointer" onClick={() => !sending && setStandardCheck(!standardCheck)}>
            <input
              type="checkbox"
              id="standardCheck"
              checked={standardCheck}
              onChange={(e) => setStandardCheck(e.target.checked)}
              disabled={sending}
              className="h-4.5 w-4.5 rounded border-border/40 bg-input text-primary focus:ring-primary focus:ring-offset-0 mt-0.5 accent-primary cursor-pointer"
            />
            <label htmlFor="standardCheck" className="text-xs text-secondary-foreground leading-normal font-medium cursor-pointer">
              I verify that all properties and links are correct, and approve dispatching this message immediately.
            </label>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 justify-end border-t border-border/10 pt-4 mt-6">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={sending}
            className="h-10 text-sm font-medium"
          >
            Cancel
          </Button>
          <Button
            variant={isBroadcast ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={!canSend || sending}
            className="h-10 text-sm font-semibold min-w-[120px]"
          >
            {sending ? 'Sending...' : isBroadcast ? 'Send Broadcast' : 'Send Push'}
          </Button>
        </div>

      </div>
    </Dialog>
  );
};

export default ConfirmDialog;
