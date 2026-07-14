'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { cn } from '@/utils/cn';

interface PreviewProps {
  title: string;
  body: string;
  imageUrl?: string;
  priority?: 'normal' | 'high';
  deepLink?: string;
}

export const NotificationPreview: React.FC<PreviewProps> = ({
  title,
  body,
  imageUrl,
  priority = 'normal',
  deepLink,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Fallback default values if empty
  const displayTitle = title.trim() || 'Notification Title';
  const displayBody = body.trim() || 'This is the notification body text. Make sure it describes the healing program, quote, or music update.';

  return (
    <div className="space-y-3 select-none">
      <div className="flex items-center justify-between">
        <h4 className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Android Device Preview</h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-primary hover:text-primary/80 font-semibold flex items-center gap-1 transition-colors"
        >
          <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Android Style Dark Card */}
      <div className="w-full bg-[#121212] border border-[#2c2c2c] rounded-2xl overflow-hidden shadow-2xl font-sans text-white text-left max-w-md mx-auto">
        {/* Status Bar Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1c1c1c]/50 border-b border-[#222] text-[11px] text-gray-400 font-medium">
          <div className="flex items-center gap-1.5">
            {/* Custom SVG logo representing a tiny Nirvaha leaf icon */}
            <div className="h-4.5 w-4.5 rounded-md bg-[#2d5a4c] flex items-center justify-center">
              <svg
                className="h-3 w-3 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
                <path d="M12 22V12" />
                <path d="M12 12c2.5-2.5 5.5-2 6.5-1" />
              </svg>
            </div>
            <span className="font-semibold text-gray-300">Nirvaha</span>
            <span className="text-gray-500">•</span>
            <span>now</span>
          </div>

          <div className="flex items-center gap-2">
            {priority === 'high' && (
              <span className="text-[9px] bg-red-950/50 border border-red-900/60 text-red-400 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                Priority
              </span>
            )}
            {deepLink && (
              <span className="text-[9px] bg-[#2d5a4c]/20 border border-[#2d5a4c]/40 text-primary px-1.5 py-0.5 rounded font-semibold tracking-wider">
                Link
              </span>
            )}
          </div>
        </div>

        {/* Content Layout */}
        <div className="p-4 space-y-3">
          {/* Main Title & text */}
          <div className="flex gap-4 items-start">
            <div className="flex-1 min-w-0">
              <h5 className="font-semibold text-sm text-gray-150 leading-tight truncate">
                {displayTitle}
              </h5>
              <p className={cn("text-xs text-gray-400 leading-normal mt-1", {
                'line-clamp-2': !isExpanded,
              })}>
                {displayBody}
              </p>
            </div>

            {/* Right thumbnail preview if image exists and collapsed */}
            {imageUrl && imageUrl.startsWith('http') && !isExpanded && (
              <div className="h-10 w-10 rounded bg-gray-800 border border-gray-700 overflow-hidden shrink-0">
                <img
                  src={imageUrl}
                  alt="Thumbnail"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    // Hide thumbnail on error
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Large Expanded Image Area */}
          {imageUrl && imageUrl.startsWith('http') && isExpanded && (
            <div className="w-full aspect-[16/9] rounded-lg bg-gray-900 border border-[#2a2a2a] overflow-hidden relative">
              <img
                src={imageUrl}
                alt="Notification Media Banner"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback container if load fails
                  const parent = (e.target as HTMLElement).parentElement;
                  if (parent) {
                    parent.innerHTML = `
                      <div class="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 text-gray-600 p-4">
                        <svg class="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375 0 11-.75 0 .375 0 01.75 0z" />
                        </svg>
                        <span class="text-[10px] uppercase font-bold tracking-wider">Failed to load preview image</span>
                      </div>
                    `;
                  }
                }}
              />
            </div>
          )}

          {/* Deep link indicator if expanded */}
          {deepLink && isExpanded && (
            <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1.5 border-t border-gray-900/50 pt-2 mt-2">
              <span className="text-[#2d5a4c] font-semibold">Intent deep link:</span>
              <span className="truncate">{deepLink}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationPreview;
