'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { adminGet, adminPost, adminDelete } from '@/lib/adminApiClient';
import { cn } from '@/utils/cn';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  EventListing,
  EventPublicationStatus,
  EventCategory,
  EventListingType,
  EventSummaryMetrics,
} from '@/types/events';
import {
  Calendar,
  Plus,
  Search,
  Filter,
  Eye,
  Edit3,
  Trash2,
  Send,
  Star,
  StarOff,
  Archive,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  MapPin,
  Globe,
  Clock,
  TrendingUp,
  FileText,
  CheckCircle,
  AlertTriangle,
  Ticket,
  BarChart3,
  Loader2,
  MoreVertical,
  ArrowUpRight,
} from 'lucide-react';

// ───────── Helpers ─────────

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  featured: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
  archived: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const LISTING_TYPE_LABELS: Record<string, string> = {
  advertisement: 'Advertisement',
  external_registration: 'External',
  free_booking: 'Free Booking',
  paid_booking: 'Paid Booking',
};

const CATEGORY_LABELS: Record<string, string> = {
  meditation: 'Meditation',
  yoga: 'Yoga',
  sound_healing: 'Sound Healing',
  breathwork: 'Breathwork',
  philosophy: 'Philosophy',
  retreat: 'Retreat',
  workshop: 'Workshop',
  temple_tour: 'Temple Tour',
  community: 'Community',
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

function relativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ───────── Status Badge ─────────

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

// ───────── Skeleton ─────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border/20 bg-card/40 p-6 animate-pulse">
      <div className="h-3 w-24 bg-secondary/40 rounded mb-3" />
      <div className="h-8 w-16 bg-secondary/30 rounded mb-2" />
      <div className="h-3 w-32 bg-secondary/20 rounded" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border/10 animate-pulse">
      <div className="h-10 w-10 rounded-lg bg-secondary/30 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 bg-secondary/30 rounded" />
        <div className="h-3 w-32 bg-secondary/20 rounded" />
      </div>
      <div className="h-6 w-20 bg-secondary/30 rounded-full" />
    </div>
  );
}

// ───────── Metric Card ─────────

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

// ───────── Confirm Action Dialog ─────────

function ActionConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  variant = 'primary',
  loading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
}) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-5">
        <p className="text-sm text-secondary-foreground leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end border-t border-border/10 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={loading} size="sm">
            Cancel
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={loading}
            size="sm"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ───────── MAIN PAGE ─────────

export default function EventsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Data state
  const [events, setEvents] = useState<EventListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<EventSummaryMetrics | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [listingTypeFilter, setListingTypeFilter] = useState('all');
  const [sortOption, setSortOption] = useState('createdAt_desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Action dialog state
  const [confirmAction, setConfirmAction] = useState<{
    event: EventListing;
    action: string;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'primary' | 'danger';
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Fetch Events ──
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<EventListing[]>('/api/events', {
        status: statusFilter,
        category: categoryFilter,
        listingType: listingTypeFilter,
        search: searchQuery || undefined,
        sort: sortOption,
        page,
        limit,
        timeframe: 'all',
      });

      if (res.success && res.data) {
        setEvents(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages);
          setTotal(res.pagination.total);
        }
      } else {
        toast(res.error || 'Failed to fetch events', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Network error', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, listingTypeFilter, searchQuery, sortOption, page, toast]);

  // ── Compute Metrics ──
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await adminGet<EventListing[]>('/api/events', {
        timeframe: 'all',
        limit: 1000,
      });
      if (res.success && res.data) {
        const all = res.data;
        const now = new Date().toISOString();
        setMetrics({
          totalEvents: all.length,
          publishedEvents: all.filter((e) => e.publicationStatus === 'published' || e.publicationStatus === 'featured').length,
          draftEvents: all.filter((e) => e.publicationStatus === 'draft').length,
          upcomingEvents: all.filter((e) => (e.schedule?.endDate || '') >= now && (e.publicationStatus === 'published' || e.publicationStatus === 'featured')).length,
          cancelledEvents: all.filter((e) => e.publicationStatus === 'cancelled').length,
          totalRegistrations: all.reduce((sum, e) => sum + (e.attendeeCount || 0), 0),
          confirmedBookings: all.reduce((sum, e) => sum + (e.confirmedBookingsCount || 0), 0),
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // ── Lifecycle Actions ──
  const handleLifecycleAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const { event, action } = confirmAction;

      if (action === 'delete') {
        const res = await adminDelete(`/api/events/${event.id}`);
        if (res.success) {
          toast('Event deleted successfully', 'success');
        } else {
          toast(res.error || 'Failed to delete event', 'error');
        }
      } else {
        const res = await adminPost(`/api/events/${event.id}/publish`, {
          action,
          notifyOnPublish: action === 'publish' || action === 'feature',
        });
        if (res.success) {
          toast(res.message || `Event ${action} successful`, 'success');
        } else {
          toast(res.error || `Failed to ${action} event`, 'error');
        }
      }

      setConfirmAction(null);
      fetchEvents();
      fetchMetrics();
    } catch (err: any) {
      toast(err.message || 'Action failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openAction = (
    event: EventListing,
    action: string,
    title: string,
    message: string,
    confirmLabel: string,
    variant: 'primary' | 'danger' = 'primary'
  ) => {
    setConfirmAction({ event, action, title, message, confirmLabel, variant });
  };

  // ── Filter Options ──
  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'featured', label: 'Featured' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'archived', label: 'Archived' },
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
  ];

  const listingTypeOptions = [
    { value: 'all', label: 'All Types' },
    ...Object.entries(LISTING_TYPE_LABELS).map(([value, label]) => ({ value, label })),
  ];

  const sortOptions = [
    { value: 'createdAt_desc', label: 'Newest First' },
    { value: 'createdAt_asc', label: 'Oldest First' },
    { value: 'startDate_asc', label: 'Upcoming First' },
    { value: 'startDate_desc', label: 'Latest Start Date' },
    { value: 'displayOrder_asc', label: 'Display Order' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120 } },
  };

  return (
    <div className="space-y-8 select-none">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-wide text-foreground/90 leading-tight">
            Events & Experiences
          </h2>
          <p className="text-secondary-foreground text-sm font-medium mt-1">
            Create, manage, and publish wellness experiences for the Nirvaha community.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { fetchEvents(); fetchMetrics(); }}
            className="h-10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/events/new">
            <Button variant="primary" size="sm" className="h-10">
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Metrics ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        <motion.div variants={itemVariants}>
          <MetricCard
            label="Total Events"
            value={metrics?.totalEvents ?? '—'}
            icon={Calendar}
            accent
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <MetricCard
            label="Published"
            value={metrics?.publishedEvents ?? '—'}
            icon={CheckCircle}
            accent
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <MetricCard
            label="Drafts"
            value={metrics?.draftEvents ?? '—'}
            icon={FileText}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <MetricCard
            label="Upcoming"
            value={metrics?.upcomingEvents ?? '—'}
            icon={TrendingUp}
            accent
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <MetricCard
            label="Bookings"
            value={metrics?.confirmedBookings ?? '—'}
            icon={Ticket}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <MetricCard
            label="Registrations"
            value={metrics?.totalRegistrations ?? '—'}
            icon={Users}
          />
        </motion.div>
      </motion.div>

      {/* ── Filters ── */}
      <Card className="border-border/20">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Search events by title, description, tags..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-10 h-10 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="w-[150px]">
                <Select
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(v) => { setStatusFilter(v); setPage(1); }}
                  placeholder="Status"
                />
              </div>
              <div className="w-[160px]">
                <Select
                  options={categoryOptions}
                  value={categoryFilter}
                  onChange={(v) => { setCategoryFilter(v); setPage(1); }}
                  placeholder="Category"
                />
              </div>
              <div className="w-[150px]">
                <Select
                  options={listingTypeOptions}
                  value={listingTypeFilter}
                  onChange={(v) => { setListingTypeFilter(v); setPage(1); }}
                  placeholder="Listing Type"
                />
              </div>
              <div className="w-[170px]">
                <Select
                  options={sortOptions}
                  value={sortOption}
                  onChange={(v) => { setSortOption(v); setPage(1); }}
                  placeholder="Sort By"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Events Table ── */}
      <Card className="border-border/20 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg">Event Listings</CardTitle>
            <CardDescription>
              {total > 0 ? `${total} event${total !== 1 ? 's' : ''} found` : 'No events match your filters'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-border/10">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="h-14 w-14 rounded-2xl bg-secondary/20 border border-border/20 flex items-center justify-center text-muted-foreground mb-4">
                <Calendar className="h-7 w-7" />
              </div>
              <h3 className="font-serif text-xl font-medium text-foreground/80 mb-2">
                No Events Found
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Start by creating your first wellness experience.'}
              </p>
              <Link href="/events/new">
                <Button variant="primary" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="hidden lg:grid grid-cols-[1fr_120px_120px_110px_100px_100px_120px] gap-3 px-5 py-3 border-b border-border/15 bg-black/15 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                <span>Event</span>
                <span>Category</span>
                <span>Date</span>
                <span>Listing Type</span>
                <span>Status</span>
                <span className="text-center">Bookings</span>
                <span className="text-right">Actions</span>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-border/10">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="grid grid-cols-1 lg:grid-cols-[1fr_120px_120px_110px_100px_100px_120px] gap-3 px-5 py-4 hover:bg-secondary/5 transition-colors items-center"
                  >
                    {/* Event Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Thumbnail */}
                      <div className="h-11 w-11 rounded-lg border border-border/20 bg-secondary/20 overflow-hidden shrink-0">
                        {event.media?.coverImageUrl ? (
                          <img
                            src={event.media.coverImageUrl}
                            alt={event.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                            <Calendar className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/events/${event.id}/edit`}
                          className="text-sm font-semibold text-foreground/90 truncate block hover:text-primary transition-colors"
                        >
                          {event.title}
                        </Link>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {event.shortDescription?.substring(0, 60)}
                          {(event.shortDescription?.length || 0) > 60 ? '...' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Category */}
                    <span className="text-xs text-secondary-foreground font-medium capitalize">
                      {CATEGORY_LABELS[event.category] || event.category}
                    </span>

                    {/* Date */}
                    <span className="text-xs text-secondary-foreground">
                      {formatDate(event.schedule?.startDate)}
                    </span>

                    {/* Listing Type */}
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {LISTING_TYPE_LABELS[event.listingType] || event.listingType}
                    </span>

                    {/* Status */}
                    <StatusBadge status={event.publicationStatus} />

                    {/* Bookings */}
                    <div className="text-center">
                      <span className="text-sm font-medium text-foreground/80">
                        {event.confirmedBookingsCount || 0}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {' '}/ {event.bookingConfig?.isUnlimitedCapacity ? '∞' : event.bookingConfig?.capacity || 0}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/events/${event.id}/edit`}>
                        <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-all" title="Edit">
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </Link>

                      {event.publicationStatus === 'draft' && (
                        <button
                          className="p-2 rounded-lg text-emerald-500/80 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                          title="Publish"
                          onClick={() =>
                            openAction(
                              event,
                              'publish',
                              'Publish Event',
                              `Are you sure you want to publish "${event.title}"? It will become visible to all users.`,
                              'Publish',
                              'primary'
                            )
                          }
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}

                      {(event.publicationStatus === 'published' || event.publicationStatus === 'featured') && (
                        <button
                          className="p-2 rounded-lg text-yellow-500/80 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all"
                          title="Unpublish"
                          onClick={() =>
                            openAction(
                              event,
                              'unpublish',
                              'Unpublish Event',
                              `Move "${event.title}" back to draft? It will no longer be visible to users.`,
                              'Unpublish',
                              'danger'
                            )
                          }
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}

                      {event.publicationStatus === 'published' && (
                        <button
                          className="p-2 rounded-lg text-purple-500/80 hover:text-purple-400 hover:bg-purple-500/10 transition-all"
                          title="Feature"
                          onClick={() =>
                            openAction(
                              event,
                              'feature',
                              'Feature Event',
                              `Feature "${event.title}" in the hero carousel? It will be highlighted across the app.`,
                              'Feature',
                              'primary'
                            )
                          }
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}

                      {event.publicationStatus !== 'cancelled' && event.publicationStatus !== 'archived' && (
                        <button
                          className="p-2 rounded-lg text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Cancel"
                          onClick={() =>
                            openAction(
                              event,
                              'cancel',
                              'Cancel Event',
                              `Cancel "${event.title}"? This will prevent new bookings and show a cancellation notice. Existing bookings will remain.`,
                              'Cancel Event',
                              'danger'
                            )
                          }
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {(event.publicationStatus === 'cancelled' || event.publicationStatus === 'draft') &&
                        (event.confirmedBookingsCount || 0) === 0 &&
                        (event.attendeeCount || 0) === 0 && (
                          <button
                            className="p-2 rounded-lg text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Delete"
                            onClick={() =>
                              openAction(
                                event,
                                'delete',
                                'Delete Event',
                                `Permanently delete "${event.title}"? This action cannot be undone.`,
                                'Delete',
                                'danger'
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-border/15 bg-black/5">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} · {total} total
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

      {/* ── Action Dialog ── */}
      {confirmAction && (
        <ActionConfirmDialog
          isOpen={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleLifecycleAction}
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          variant={confirmAction.variant}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

