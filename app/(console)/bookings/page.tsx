'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { adminGet, adminPost } from '@/lib/adminApiClient';
import { cn } from '@/utils/cn';
import { motion } from 'framer-motion';
import type { EventBooking, BookingStatus, BookingSummaryMetrics } from '@/types/bookings';
import type { EventListing } from '@/types/events';
import {
  Ticket,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  Loader2,
  Users,
  Eye,
  FileSpreadsheet,
  QrCode,
  ShieldCheck,
  Camera,
} from 'lucide-react';
import QRScannerModal from '@/components/bookings/QRScannerModal';
import AttendeeLegibilityCard from '@/components/bookings/AttendeeLegibilityCard';

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
  waitlist: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  attended: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border',
        STATUS_COLORS[status] || 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
      )}
    >
      {status}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<any>;
  accent?: boolean;
}) {
  return (
    <Card className="border-border/20 hover:border-primary/30 transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
            {label}
          </span>
          <div
            className={cn(
              'p-1.5 rounded-lg border',
              accent
                ? 'bg-primary/10 border-primary/20 text-primary'
                : 'bg-secondary/20 border-border/10 text-muted-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-serif font-medium tracking-wide">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function BookingsPage() {
  const { toast } = useToast();

  const [bookings, setBookings] = useState<EventBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsList, setEventsList] = useState<{ id: string; title: string }[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modals
  const [selectedBooking, setSelectedBooking] = useState<EventBooking | null>(null);
  const [cancelModalBooking, setCancelModalBooking] = useState<EventBooking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Fetch Events for filter dropdown
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await adminGet<EventListing[]>('/api/events', { limit: 100 });
        if (res.success && res.data) {
          setEventsList(res.data.map((e) => ({ id: e.id, title: e.title })));
        }
      } catch {}
    };
    fetchEvents();
  }, []);

  // Fetch Bookings
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<EventBooking[]>('/api/bookings', {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        eventId: eventFilter !== 'all' ? eventFilter : undefined,
        search: searchQuery || undefined,
      });

      if (res.success && res.data) {
        setBookings(res.data);
      } else {
        toast(res.error || 'Failed to fetch bookings', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Network error fetching bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, eventFilter, searchQuery, toast]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Compute Metrics
  const metrics: BookingSummaryMetrics = {
    totalBookings: bookings.length,
    confirmedBookings: bookings.filter((b) => b.status === 'confirmed').length,
    cancelledBookings: bookings.filter((b) => b.status === 'cancelled').length,
    attendedBookings: bookings.filter((b) => b.status === 'attended').length,
    totalSeatsReserved: bookings.reduce(
      (sum, b) => (b.status === 'confirmed' || b.status === 'attended' ? sum + (b.participantCount || 1) : sum),
      0
    ),
  };

  // Pagination slice
  const totalItems = bookings.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const paginatedBookings = bookings.slice((page - 1) * limit, page * limit);

  // Cancellation handler
  const handleCancelBooking = async () => {
    if (!cancelModalBooking) return;
    setCancelling(true);
    try {
      const res = await adminPost(`/api/bookings/${cancelModalBooking.id}/cancel`, {
        reason: cancelReason || 'Cancelled by administrator',
        cancelledBy: 'admin',
      });

      if (res.success) {
        toast('Booking cancelled successfully. Seats have been restored.', 'success');
        setCancelModalBooking(null);
        setCancelReason('');
        if (selectedBooking?.id === cancelModalBooking.id) {
          setSelectedBooking(null);
        }
        fetchBookings();
      } else {
        toast(res.error || 'Failed to cancel booking', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to cancel booking', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const [scanRef, setScanRef] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Quick Check-In / QR Scanner handler
  const handleCheckIn = async (targetRefOrId: string) => {
    const clean = targetRefOrId.trim();
    if (!clean) {
      toast('Please enter or scan a pass reference code', 'error');
      return;
    }
    setIsCheckingIn(true);
    try {
      const res: any = await adminPost('/api/bookings/check-in', {
        reference: clean,
        bookingId: clean,
      });

      if (res?.success) {
        toast(res.message || `Successfully checked in attendee!`, 'success');
        setScanRef('');
        fetchBookings();
        if (selectedBooking && (selectedBooking.id === clean || selectedBooking.bookingReference === clean)) {
          setSelectedBooking(res.booking);
        }
      } else {
        toast(res?.error || 'Check-in failed. Please verify reference code.', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Check-in request failed', 'error');
    } finally {
      setIsCheckingIn(false);
    }
  };
  const exportCsv = () => {
    if (bookings.length === 0) {
      toast('No bookings available to export', 'error');
      return;
    }

    const headers = [
      'Booking Reference',
      'Event Title',
      'Event Date',
      'User Name',
      'User Email',
      'User Phone',
      'Seats',
      'Status',
      'Booked At',
      'Cancelled At',
      'Cancellation Reason',
    ];

    const rows = bookings.map((b) => [
      `"${b.bookingReference || ''}"`,
      `"${(b.eventTitle || '').replace(/"/g, '""')}"`,
      `"${formatDate(b.eventDate || b.eventStartDate)}"`,
      `"${(b.userName || '').replace(/"/g, '""')}"`,
      `"${b.userEmail || ''}"`,
      `"${b.userPhone || ''}"`,
      b.participantCount || 1,
      `"${b.status || ''}"`,
      `"${formatDateTime(b.bookedAt)}"`,
      `"${formatDateTime(b.cancelledAt)}"`,
      `"${(b.cancellationReason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nirvaha_bookings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast('Bookings CSV exported successfully', 'success');
  };

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'attended', label: 'Attended' },
    { value: 'waitlist', label: 'Waitlist' },
  ];

  const eventFilterOptions = [
    { value: 'all', label: 'All Events' },
    ...eventsList.map((e) => ({ value: e.id, label: e.title })),
  ];

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-wide text-foreground/90 leading-tight">
            Bookings Management
          </h2>
          <p className="text-secondary-foreground text-sm font-medium mt-1">
            Review attendee reservations, verify guest passes, and oversee experience capacity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={fetchBookings} className="h-10">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-10">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard label="Total Bookings" value={metrics.totalBookings} icon={Ticket} accent />
        <MetricCard label="Confirmed" value={metrics.confirmedBookings} icon={CheckCircle} accent />
        <MetricCard label="Seats Reserved" value={metrics.totalSeatsReserved} icon={Users} accent />
        <MetricCard label="Cancelled" value={metrics.cancelledBookings} icon={XCircle} />
        <MetricCard label="Attended" value={metrics.attendedBookings} icon={Clock} />
      </div>

      {/* Sanctuary Gate Quick Check-In & Scanner Bar */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Sanctuary Gate Admission & Attendance</h4>
                <p className="text-xs text-muted-foreground">Scan attendee QR pass or enter reference code to verify legibility and admit guests</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <Button
                type="button"
                variant="primary"
                onClick={() => setIsScannerOpen(true)}
                className="h-10 px-4 text-xs font-semibold shadow-md shadow-primary/20 flex items-center gap-2 whitespace-nowrap"
              >
                <Camera className="h-4 w-4" />
                <span>Live QR Camera Scanner</span>
              </Button>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCheckIn(scanRef);
                }}
                className="flex flex-1 sm:flex-none items-center gap-2"
              >
                <div className="relative w-full sm:w-56">
                  <Input
                    placeholder="e.g. NIR-EVT-XXXXXX"
                    value={scanRef}
                    onChange={(e) => setScanRef(e.target.value.toUpperCase())}
                    className="font-mono text-sm tracking-wider h-10 bg-black/40 border-primary/30 uppercase"
                  />
                </div>
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={!scanRef.trim() || isCheckingIn}
                  className="h-10 px-4 text-xs font-semibold whitespace-nowrap"
                >
                  {isCheckingIn ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Admitting...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-primary" />
                      Admit
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Row */}
      <Card className="border-border/20">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Search by reference (NIR-...), user name, or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-10 h-10 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="w-[160px]">
                <Select
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                  placeholder="Status"
                />
              </div>
              <div className="w-[200px]">
                <Select
                  options={eventFilterOptions}
                  value={eventFilter}
                  onChange={(v) => {
                    setEventFilter(v);
                    setPage(1);
                  }}
                  placeholder="Filter by Event"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card className="border-border/20 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg">Reservations List</CardTitle>
            <CardDescription>
              {totalItems > 0 ? `${totalItems} reservation${totalItems !== 1 ? 's' : ''} found` : 'No reservations recorded'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 flex justify-center items-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : paginatedBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="h-14 w-14 rounded-2xl bg-secondary/20 border border-border/20 flex items-center justify-center text-muted-foreground mb-4">
                <Ticket className="h-7 w-7" />
              </div>
              <h3 className="font-serif text-xl font-medium text-foreground/80 mb-2">No Bookings Found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {searchQuery || statusFilter !== 'all' || eventFilter !== 'all'
                  ? 'No reservations matched your current filter criteria.'
                  : 'Users have not made any event reservations yet.'}
              </p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="hidden lg:grid grid-cols-[130px_1fr_1fr_80px_100px_130px_100px] gap-3 px-5 py-3 border-b border-border/15 bg-black/15 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                <span>Reference</span>
                <span>Event</span>
                <span>User</span>
                <span className="text-center">Seats</span>
                <span>Status</span>
                <span>Booked At</span>
                <span className="text-right">Actions</span>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-border/10">
                {paginatedBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="grid grid-cols-1 lg:grid-cols-[130px_1fr_1fr_80px_100px_130px_100px] gap-3 px-5 py-4 hover:bg-secondary/5 transition-colors items-center"
                  >
                    {/* Reference */}
                    <div className="font-mono text-xs font-semibold text-primary">
                      {booking.bookingReference}
                    </div>

                    {/* Event Title */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground/90 truncate">{booking.eventTitle}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {formatDate(booking.eventDate || booking.eventStartDate)}
                      </p>
                    </div>

                    {/* User Info */}
                    <div className="min-w-0">
                      <p className="text-sm text-foreground/90 truncate">{booking.userName}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{booking.userEmail}</p>
                    </div>

                    {/* Participant Count */}
                    <div className="text-center">
                      <span className="text-sm font-medium text-foreground/90 bg-secondary/30 px-2 py-0.5 rounded-md border border-border/10">
                        {booking.participantCount || 1}
                      </span>
                    </div>

                    {/* Status */}
                    <div>
                      <StatusBadge status={booking.status} />
                    </div>

                    {/* Booked Date */}
                    <div className="text-xs text-secondary-foreground">
                      {formatDate(booking.bookedAt)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5">
                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => handleCheckIn(booking.id)}
                          disabled={isCheckingIn}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-all flex items-center gap-1 shrink-0"
                          title="Check In & Admit Attendee"
                        >
                          <CheckCircle className="h-3 w-3" />
                          <span>Admit</span>
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedBooking(booking)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-all"
                        title="View Legibility & Pass Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => handleCheckIn(booking.bookingReference || booking.id)}
                          className="p-2 rounded-lg text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                          title="Quick Admit Attendee"
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </button>
                      )}

                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => setCancelModalBooking(booking)}
                          className="p-2 rounded-lg text-red-500/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Cancel Reservation"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Bar */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-border/15 bg-black/5">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} · {totalItems} total bookings
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Booking Details & Legibility Verification Modal */}
      {selectedBooking && (
        <Dialog
          isOpen={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          title={`Visitor Pass: ${selectedBooking.bookingReference}`}
          className="max-w-2xl bg-[#0B100E] border-border/40 text-foreground"
        >
          <AttendeeLegibilityCard
            booking={selectedBooking}
            onAdmit={async (b) => {
              await handleCheckIn(b.id);
            }}
            isAdmitting={isCheckingIn}
            onClose={() => setSelectedBooking(null)}
          />
        </Dialog>
      )}

      {/* Cancel Confirmation Dialog */}
      {cancelModalBooking && (
        <Dialog
          isOpen={!!cancelModalBooking}
          onClose={() => {
            setCancelModalBooking(null);
            setCancelReason('');
          }}
          title="Cancel Reservation"
        >
          <div className="space-y-4 text-sm">
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-xs flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Confirm seat cancellation</p>
                <p className="mt-1">
                  Cancelling reservation <strong>{cancelModalBooking.bookingReference}</strong> for{' '}
                  <strong>{cancelModalBooking.userName}</strong> will immediately return{' '}
                  <strong>{cancelModalBooking.participantCount} seat(s)</strong> back to the event capacity pool.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Cancellation Reason
              </label>
              <Input
                placeholder="e.g., Requested by user via support ticket"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border/10">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCancelModalBooking(null);
                  setCancelReason('');
                }}
                disabled={cancelling}
              >
                Keep Booking
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleCancelBooking}
                disabled={cancelling}
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Live QR Camera Scanner & Legibility Verification Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onCheckInSuccess={() => {
          fetchBookings();
        }}
      />
    </div>
  );
}

