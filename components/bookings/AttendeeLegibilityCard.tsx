'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/utils/cn';
import type { EventBooking } from '@/types/bookings';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Users,
  QrCode,
  Loader2,
  Clock,
  ArrowRight,
  Info,
  Sparkles,
} from 'lucide-react';

interface AttendeeLegibilityCardProps {
  booking: EventBooking;
  onAdmit?: (booking: EventBooking) => Promise<void>;
  isAdmitting?: boolean;
  onScanNext?: () => void;
  onClose?: () => void;
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AttendeeLegibilityCard: React.FC<AttendeeLegibilityCardProps> = ({
  booking,
  onAdmit,
  isAdmitting = false,
  onScanNext,
  onClose,
}) => {
  const isConfirmed = booking.status === 'confirmed';
  const isAttended = booking.status === 'attended';
  const isCancelled = booking.status === 'cancelled';
  const isWaitlist = booking.status === 'waitlist';

  return (
    <div className="space-y-4">
      {/* 1. Master Legibility Status Banner */}
      <div
        className={cn(
          'p-4 rounded-xl border flex items-start gap-3 transition-all',
          isConfirmed && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          isAttended && 'bg-blue-500/10 border-blue-500/30 text-blue-400',
          isCancelled && 'bg-red-500/10 border-red-500/30 text-red-400',
          isWaitlist && 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        )}
      >
        <div className="p-2 rounded-lg bg-black/30 shrink-0">
          {isConfirmed && <ShieldCheck className="h-6 w-6 text-emerald-400" />}
          {isAttended && <CheckCircle2 className="h-6 w-6 text-blue-400" />}
          {isCancelled && <XCircle className="h-6 w-6 text-red-400" />}
          {isWaitlist && <Clock className="h-6 w-6 text-amber-400" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base tracking-wide">
              {isConfirmed && 'VALID PASS — READY FOR ADMISSION'}
              {isAttended && 'PASS ALREADY REDEEMED / ADMITTED'}
              {isCancelled && 'CANCELLED RESERVATION — ENTRY VOID'}
              {isWaitlist && 'WAITLIST RESERVATION — NOT CONFIRMED'}
            </h3>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-black/40 uppercase tracking-widest border border-current/20">
              {booking.bookingReference}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isConfirmed && 'Official Nirvaha Pass verified. Seats are confirmed and allocated.'}
            {isAttended &&
              `This guest pass was checked in on ${formatDateTime(booking.checkedInAt)} by ${
                booking.checkedInBy || 'Gate Staff'
              }. Ensure re-entry authenticity.`}
            {isCancelled &&
              `Reservation was cancelled on ${formatDateTime(booking.cancelledAt)}. Reason: ${
                booking.cancellationReason || 'No reason specified'
              }.`}
            {isWaitlist && 'Guest is currently on the waitlist. Seats have not been confirmed.'}
          </p>
        </div>
      </div>

      {/* 2. Experience & Schedule Context */}
      <Card className="border-border/20 bg-card/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-semibold text-primary tracking-wider">
                Event & Sanctuary
              </span>
              <h4 className="font-serif text-lg font-medium text-foreground/90">
                {booking.eventTitle || 'Nirvaha Sanctuary Gathering'}
              </h4>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Users className="h-3.5 w-3.5" />
              {booking.participantCount} {booking.participantCount === 1 ? 'Seat' : 'Seats'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/10 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>{formatDateTime(booking.eventStartDate || booking.eventDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="truncate">{booking.eventVenueOrUrl || 'Sanctuary Main Hall'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Primary Guest Contact Profile */}
      <Card className="border-border/20 bg-card/60">
        <CardContent className="p-4 space-y-3">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            Primary Attendee Identity
          </span>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-medium text-base">
              {(booking.userName || 'G')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="font-medium text-foreground text-sm truncate">{booking.userName}</h5>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1 truncate">
                  <Mail className="h-3 w-3 text-muted-foreground/70" />
                  {booking.userEmail}
                </span>
                {booking.userPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-muted-foreground/70" />
                    {booking.userPhone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Attendee Roster Breakdown (if multi-seat or details exist) */}
      {booking.attendeeDetails && booking.attendeeDetails.length > 0 && (
        <Card className="border-border/20 bg-card/60">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Guest Roster & Dietary / Notes ({booking.attendeeDetails.length})
              </span>
              <span className="text-[10px] text-muted-foreground">Door verification</span>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {booking.attendeeDetails.map((att, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-secondary/20 border border-border/10 text-xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground/90">
                        {idx + 1}. {att.fullName || `Guest ${idx + 1}`}
                      </span>
                      {idx === 0 && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/20 text-primary border border-primary/30">
                          Lead
                        </span>
                      )}
                    </div>
                    {att.email && <div className="text-[11px] text-muted-foreground">{att.email}</div>}
                  </div>
                  {(att.dietary || att.notes) && (
                    <div className="text-[11px] text-amber-400/90 font-mono text-right max-w-[180px] truncate">
                      {att.dietary ? `Diet: ${att.dietary}` : att.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Gate Admission Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="w-full sm:w-auto flex items-center gap-2">
          {onScanNext && (
            <Button
              type="button"
              variant="secondary"
              onClick={onScanNext}
              className="flex-1 sm:flex-none h-11 px-4 text-xs font-semibold"
            >
              <QrCode className="h-4 w-4 mr-2 text-primary" />
              Scan Next Pass
            </Button>
          )}
          {onClose && (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 sm:flex-none h-11 px-4 text-xs"
            >
              Close
            </Button>
          )}
        </div>

        {isConfirmed && onAdmit && (
          <Button
            type="button"
            variant="primary"
            disabled={isAdmitting}
            onClick={() => onAdmit(booking)}
            className="w-full sm:w-auto h-11 px-6 text-sm font-semibold shadow-lg shadow-primary/20"
          >
            {isAdmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording Admission...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Admit & Check In ({booking.participantCount} {booking.participantCount === 1 ? 'Guest' : 'Guests'})
              </>
            )}
          </Button>
        )}

        {isAttended && (
          <div className="text-xs text-blue-400 font-medium flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <CheckCircle2 className="h-4 w-4" />
            Admitted on {formatDateTime(booking.checkedInAt)}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendeeLegibilityCard;
