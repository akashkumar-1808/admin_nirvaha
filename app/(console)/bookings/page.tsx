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
} from 'lucide-react';

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

  // CSV Export
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
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelectedBooking(booking)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-all"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

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

      {/* Booking Details Modal */}
      {selectedBooking && (
        <Dialog
          isOpen={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          title={`Booking Pass: ${selectedBooking.bookingReference}`}
        >
          <div className="space-y-5 text-sm">
            {/* Status & Event Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/15">
              <div>
                <h4 className="font-semibold text-foreground/95 text-base">{selectedBooking.eventTitle}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDateTime(selectedBooking.eventDate || selectedBooking.eventStartDate)}
                </p>
              </div>
              <StatusBadge status={selectedBooking.status} />
            </div>

            {/* User Contact */}
            <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-secondary/10 border border-border/15">
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                  Primary Guest
                </span>
                <p className="font-medium text-foreground/90 mt-1">{selectedBooking.userName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedBooking.userEmail}</p>
                {selectedBooking.userPhone && (
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedBooking.userPhone}</p>
                )}
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                  Reservation Details
                </span>
                <p className="text-xs text-foreground/90 mt-1">
                  Seats Reserved: <span className="font-bold text-primary">{selectedBooking.participantCount}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Booked on: {formatDateTime(selectedBooking.bookedAt)}
                </p>
                {selectedBooking.cancelledAt && (
                  <p className="text-xs text-red-400 mt-1">
                    Cancelled: {formatDateTime(selectedBooking.cancelledAt)}
                  </p>
                )}
              </div>
            </div>

            {/* Attendee Details breakdown */}
            {selectedBooking.attendeeDetails && selectedBooking.attendeeDetails.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Attendee Roster ({selectedBooking.attendeeDetails.length})
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedBooking.attendeeDetails.map((attendee, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-border/15 bg-black/10 text-xs flex justify-between items-center"
                    >
                      <div>
                        <p className="font-medium text-foreground/90">
                          {idx + 1}. {attendee.fullName}
                        </p>
                        {attendee.email && <p className="text-muted-foreground">{attendee.email}</p>}
                      </div>
                      {attendee.dietary && (
                        <span className="px-2 py-0.5 rounded bg-secondary/30 text-[10px] text-secondary-foreground">
                          Diet: {attendee.dietary}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cancellation reason if present */}
            {selectedBooking.cancellationReason && (
              <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-xs">
                <span className="font-semibold text-red-300 block mb-0.5">Cancellation Reason</span>
                <p className="text-secondary-foreground">{selectedBooking.cancellationReason}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-border/10">
              {selectedBooking.status === 'confirmed' && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setCancelModalBooking(selectedBooking);
                  }}
                >
                  Cancel Booking
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setSelectedBooking(null)}>
                Close
              </Button>
            </div>
          </div>
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
    </div>
  );
}

