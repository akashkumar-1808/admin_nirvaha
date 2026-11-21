'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { adminGet, adminPut } from '@/lib/adminApiClient';
import { cn } from '@/utils/cn';
import type {
  EventListing,
  EventCategory,
  EventListingType,
  EventLocationType,
  UpdateEventInput,
  AttendeeField,
} from '@/types/events';
import {
  ArrowLeft,
  Save,
  Users,
  CreditCard,
  Image as ImageIcon,
  Tag,
  Clock,
  Info,
  Loader2,
  MapPin,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

const CATEGORY_OPTIONS = [
  { value: 'meditation', label: 'Meditation' },
  { value: 'yoga', label: 'Yoga & Movement' },
  { value: 'sound_healing', label: 'Sound Healing' },
  { value: 'breathwork', label: 'Breathwork' },
  { value: 'philosophy', label: 'Philosophy' },
  { value: 'retreat', label: 'Retreat' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'temple_tour', label: 'Temple Tour' },
  { value: 'community', label: 'Community' },
];

const LISTING_TYPE_OPTIONS = [
  { value: 'advertisement', label: 'Advertisement', description: 'Informational card, no booking' },
  { value: 'external_registration', label: 'External Registration', description: 'Redirect to third-party URL' },
  { value: 'free_booking', label: 'Free Booking', description: 'In-app free seat reservation' },
  { value: 'paid_booking', label: 'Paid Booking', description: 'In-app paid reservation (requires payment provider)' },
];

const LOCATION_TYPE_OPTIONS = [
  { value: 'offline', label: 'In-Person' },
  { value: 'online', label: 'Online' },
  { value: 'hybrid', label: 'Hybrid' },
];

const ATTENDEE_FIELD_OPTIONS: { value: AttendeeField; label: string }[] = [
  { value: 'fullName', label: 'Full Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'notes', label: 'Notes' },
  { value: 'dietary', label: 'Dietary Requirements' },
  { value: 'emergency_contact', label: 'Emergency Contact' },
];

function FormSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<any>;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/20">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
      {label}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function toDatetimeLocal(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

function fromDatetimeLocal(val: string): string {
  if (!val) return '';
  return new Date(val).toISOString();
}

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params?.id as string;
  const { toast } = useToast();

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eventData, setEventData] = useState<EventListing | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('meditation');
  const [tags, setTags] = useState('');

  // Organizer
  const [organizerName, setOrganizerName] = useState('');
  const [organizerEmail, setOrganizerEmail] = useState('');
  const [organizerBio, setOrganizerBio] = useState('');
  const [organizerAvatar, setOrganizerAvatar] = useState('');

  // Media
  const [coverImageUrl, setCoverImageUrl] = useState('');

  // Schedule
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [registrationDeadline, setRegistrationDeadline] = useState('');

  // Location
  const [locationType, setLocationType] = useState<EventLocationType>('offline');
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');

  // Listing config
  const [listingType, setListingType] = useState<EventListingType>('free_booking');
  const [externalUrl, setExternalUrl] = useState('');

  // Booking config
  const [capacity, setCapacity] = useState(50);
  const [isUnlimitedCapacity, setIsUnlimitedCapacity] = useState(false);
  const [maxPerBooking, setMaxPerBooking] = useState(1);
  const [regOpenDate, setRegOpenDate] = useState('');
  const [regCloseDate, setRegCloseDate] = useState('');
  const [requiredFields, setRequiredFields] = useState<AttendeeField[]>(['fullName', 'email']);
  const [cancellationPolicy, setCancellationPolicy] = useState('');
  const [allowWaitlist, setAllowWaitlist] = useState(false);

  // Payment config
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentCurrency, setPaymentCurrency] = useState('INR');

  // Display
  const [displayOrder, setDisplayOrder] = useState(0);
  const [notifyOnPublish, setNotifyOnPublish] = useState(true);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!eventId) return;
    const fetchEvent = async () => {
      setInitialLoading(true);
      try {
        const res = await adminGet<EventListing>(`/api/events/${eventId}`);
        if (res.success && res.data) {
          const ev = res.data;
          setEventData(ev);
          setTitle(ev.title || '');
          setShortDescription(ev.shortDescription || '');
          setFullDescription(ev.fullDescription || '');
          setCategory(ev.category || 'meditation');
          setTags((ev.tags || []).join(', '));

          setOrganizerName(ev.organizer?.name || '');
          setOrganizerEmail(ev.organizer?.email || '');
          setOrganizerBio(ev.organizer?.bio || '');
          setOrganizerAvatar(ev.organizer?.avatarUrl || '');

          setCoverImageUrl(ev.media?.coverImageUrl || '');

          setStartDate(toDatetimeLocal(ev.schedule?.startDate));
          setEndDate(toDatetimeLocal(ev.schedule?.endDate));
          setTimezone(ev.schedule?.timezone || 'Asia/Kolkata');
          setRegistrationDeadline(toDatetimeLocal(ev.schedule?.registrationDeadline));

          setLocationType(ev.location?.type || 'offline');
          setVenueName(ev.location?.venueName || '');
          setAddress(ev.location?.address || '');
          setCity(ev.location?.city || '');
          setMeetingUrl(ev.location?.meetingUrl || '');
          setAccessInstructions(ev.location?.accessInstructions || '');

          setListingType(ev.listingType || 'free_booking');
          setExternalUrl(ev.externalUrl || '');

          setCapacity(ev.bookingConfig?.capacity ?? 50);
          setIsUnlimitedCapacity(ev.bookingConfig?.isUnlimitedCapacity ?? false);
          setMaxPerBooking(ev.bookingConfig?.maxParticipantsPerBooking ?? 1);
          setRegOpenDate(toDatetimeLocal(ev.bookingConfig?.registrationOpenDate));
          setRegCloseDate(toDatetimeLocal(ev.bookingConfig?.registrationCloseDate));
          setRequiredFields(ev.bookingConfig?.requiredAttendeeFields || ['fullName', 'email']);
          setCancellationPolicy(ev.bookingConfig?.cancellationPolicy || '');
          setAllowWaitlist(ev.bookingConfig?.allowWaitlist ?? false);

          setPaymentEnabled(ev.paymentConfig?.enabled ?? false);
          setPaymentAmount(ev.paymentConfig?.amount ?? 0);
          setPaymentCurrency(ev.paymentConfig?.currency || 'INR');

          setDisplayOrder(ev.displayOrder ?? 0);
          setNotifyOnPublish(ev.notifyOnPublish ?? true);
        } else {
          toast(res.error || 'Failed to load event', 'error');
          router.push('/events');
        }
      } catch (err: any) {
        toast(err.message || 'Error loading event', 'error');
        router.push('/events');
      } finally {
        setInitialLoading(false);
      }
    };
    fetchEvent();
  }, [eventId, router, toast]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!title.trim() || title.trim().length < 3) e.title = 'Title must be at least 3 characters';
    if (title.trim().length > 120) e.title = 'Title cannot exceed 120 characters';
    if (!shortDescription.trim() || shortDescription.trim().length < 10) e.shortDescription = 'Short description must be at least 10 characters';
    if (shortDescription.trim().length > 250) e.shortDescription = 'Short description cannot exceed 250 characters';
    if (!startDate) e.startDate = 'Start date is required';
    if (!endDate) e.endDate = 'End date is required';
    if (startDate && endDate && startDate >= endDate) e.endDate = 'End date must be after start date';
    if (!organizerName.trim()) e.organizerName = 'Organizer name is required';
    if (listingType === 'external_registration' && !externalUrl.trim()) e.externalUrl = 'External URL is required';
    if (listingType === 'paid_booking' && (!paymentEnabled || paymentAmount <= 0)) e.paymentAmount = 'Valid payment amount is required';
    if ((locationType === 'offline' || locationType === 'hybrid') && !venueName.trim()) e.venueName = 'Venue name is required';
    if ((locationType === 'online' || locationType === 'hybrid') && !meetingUrl.trim()) e.meetingUrl = 'Meeting URL is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleUpdate = async () => {
    if (!validate()) {
      toast('Please fix the validation errors', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: UpdateEventInput = {
        title: title.trim(),
        shortDescription: shortDescription.trim(),
        fullDescription: fullDescription.trim(),
        category,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        organizer: {
          name: organizerName.trim(),
          email: organizerEmail.trim() || undefined,
          bio: organizerBio.trim() || undefined,
          avatarUrl: organizerAvatar.trim() || undefined,
        },
        media: {
          coverImageUrl: coverImageUrl.trim(),
          galleryImageUrls: eventData?.media?.galleryImageUrls || [],
        },
        schedule: {
          startDate: fromDatetimeLocal(startDate),
          endDate: fromDatetimeLocal(endDate),
          timezone,
          registrationDeadline: registrationDeadline ? fromDatetimeLocal(registrationDeadline) : undefined,
        },
        location: {
          type: locationType,
          venueName: venueName.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          meetingUrl: meetingUrl.trim() || undefined,
          accessInstructions: accessInstructions.trim() || undefined,
        },
        listingType,
        externalUrl: externalUrl.trim() || undefined,
        bookingConfig: {
          capacity: isUnlimitedCapacity ? 0 : capacity,
          isUnlimitedCapacity,
          maxParticipantsPerBooking: maxPerBooking,
          registrationOpenDate: regOpenDate ? fromDatetimeLocal(regOpenDate) : fromDatetimeLocal(startDate),
          registrationCloseDate: regCloseDate ? fromDatetimeLocal(regCloseDate) : fromDatetimeLocal(endDate),
          requiredAttendeeFields: requiredFields,
          cancellationPolicy: cancellationPolicy.trim() || undefined,
          allowWaitlist,
        },
        paymentConfig: {
          enabled: listingType === 'paid_booking' ? true : paymentEnabled,
          currency: paymentCurrency,
          amount: paymentAmount,
          provider: eventData?.paymentConfig?.provider || 'none',
          providerStatus: eventData?.paymentConfig?.providerStatus || 'unconfigured',
        },
        displayOrder,
        notifyOnPublish,
      };

      const res = await adminPut(`/api/events/${eventId}`, payload);

      if (res.success) {
        toast('Event updated successfully!', 'success');
        router.push('/events');
      } else {
        toast(res.error || 'Failed to update event', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Network error', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
        <p className="text-sm text-muted-foreground">Loading event details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/events')}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-2xl md:text-3xl font-medium tracking-wide text-foreground/90">
              Edit Event
            </h2>
            {eventData?.publicationStatus && (
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-secondary/30 border border-border/20 text-muted-foreground">
                {eventData.publicationStatus}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Modify configuration, schedule, venue, and ticketing parameters.
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <FormSection title="Basic Information" description="Title, description, and category" icon={Info}>
        <div>
          <FieldLabel label="Event Title" required />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Full Moon Meditation Circle"
            maxLength={120}
          />
          {errors.title && <p className="text-xs text-red-400 mt-1">{errors.title}</p>}
          <p className="text-xs text-muted-foreground/60 mt-1">{title.length}/120</p>
        </div>

        <div>
          <FieldLabel label="Short Description" required />
          <Textarea
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder="A brief summary visible in event cards (10-250 chars)"
            maxLength={250}
            className="min-h-[70px]"
          />
          {errors.shortDescription && <p className="text-xs text-red-400 mt-1">{errors.shortDescription}</p>}
          <p className="text-xs text-muted-foreground/60 mt-1">{shortDescription.length}/250</p>
        </div>

        <div>
          <FieldLabel label="Full Description" />
          <Textarea
            value={fullDescription}
            onChange={(e) => setFullDescription(e.target.value)}
            placeholder="Detailed event information, what participants can expect..."
            className="min-h-[120px]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Category" required />
            <Select
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={(v) => setCategory(v as EventCategory)}
              placeholder="Select category"
            />
          </div>
          <div>
            <FieldLabel label="Tags" />
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated: healing, beginner, full-moon"
            />
          </div>
        </div>
      </FormSection>

      {/* Organizer */}
      <FormSection title="Organizer / Guide" description="Host or leader details" icon={Users}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Name" required />
            <Input
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
              placeholder="Teacher or guide name"
            />
            {errors.organizerName && <p className="text-xs text-red-400 mt-1">{errors.organizerName}</p>}
          </div>
          <div>
            <FieldLabel label="Contact Email" />
            <Input
              value={organizerEmail}
              onChange={(e) => setOrganizerEmail(e.target.value)}
              placeholder="guide@nirvaha.com"
              type="email"
            />
          </div>
        </div>
        <div>
          <FieldLabel label="Bio" />
          <Textarea
            value={organizerBio}
            onChange={(e) => setOrganizerBio(e.target.value)}
            placeholder="Short bio or credentials"
            className="min-h-[70px]"
          />
        </div>
        <div>
          <FieldLabel label="Avatar URL" />
          <Input
            value={organizerAvatar}
            onChange={(e) => setOrganizerAvatar(e.target.value)}
            placeholder="https://..."
          />
        </div>
      </FormSection>

      {/* Media */}
      <FormSection title="Cover Image" description="Visual banner" icon={ImageIcon}>
        <div>
          <FieldLabel label="Cover Image URL" />
          <Input
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://..."
          />
          {coverImageUrl && (
            <div className="mt-3 rounded-xl overflow-hidden border border-border/20 max-h-48">
              <img
                src={coverImageUrl}
                alt="Cover preview"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>
      </FormSection>

      {/* Schedule */}
      <FormSection title="Schedule" description="Timings and deadline" icon={Clock}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Start Date & Time" required />
            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            {errors.startDate && <p className="text-xs text-red-400 mt-1">{errors.startDate}</p>}
          </div>
          <div>
            <FieldLabel label="End Date & Time" required />
            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {errors.endDate && <p className="text-xs text-red-400 mt-1">{errors.endDate}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Timezone" />
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Asia/Kolkata"
            />
          </div>
          <div>
            <FieldLabel label="Registration Deadline" />
            <Input
              type="datetime-local"
              value={registrationDeadline}
              onChange={(e) => setRegistrationDeadline(e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      {/* Location */}
      <FormSection title="Location" description="Format and address" icon={MapPin}>
        <div>
          <FieldLabel label="Location Type" required />
          <Select
            options={LOCATION_TYPE_OPTIONS}
            value={locationType}
            onChange={(v) => setLocationType(v as EventLocationType)}
          />
        </div>

        {(locationType === 'offline' || locationType === 'hybrid') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel label="Venue Name" required />
              <Input
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="Venue name"
              />
              {errors.venueName && <p className="text-xs text-red-400 mt-1">{errors.venueName}</p>}
            </div>
            <div>
              <FieldLabel label="City" />
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel label="Full Address" />
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address"
              />
            </div>
          </div>
        )}

        {(locationType === 'online' || locationType === 'hybrid') && (
          <div>
            <FieldLabel label="Meeting URL" required />
            <Input
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://..."
            />
            {errors.meetingUrl && <p className="text-xs text-red-400 mt-1">{errors.meetingUrl}</p>}
          </div>
        )}

        <div>
          <FieldLabel label="Access Instructions" />
          <Textarea
            value={accessInstructions}
            onChange={(e) => setAccessInstructions(e.target.value)}
            placeholder="Instructions for attendees..."
            className="min-h-[60px]"
          />
        </div>
      </FormSection>

      {/* Listing Type */}
      <FormSection title="Listing Configuration" description="Card interaction mode" icon={Tag}>
        <div>
          <FieldLabel label="Listing Type" required />
          <Select
            options={LISTING_TYPE_OPTIONS}
            value={listingType}
            onChange={(v) => {
              setListingType(v as EventListingType);
              if (v === 'paid_booking') setPaymentEnabled(true);
              else setPaymentEnabled(false);
            }}
          />
        </div>

        {listingType === 'paid_booking' && (
          <div className="p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-300/90 leading-relaxed">
              <strong>Note:</strong> Paid booking events cannot be published without an active, verified payment provider.
            </p>
          </div>
        )}

        {listingType === 'external_registration' && (
          <div>
            <FieldLabel label="External Registration URL" required />
            <Input
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://..."
            />
            {errors.externalUrl && <p className="text-xs text-red-400 mt-1">{errors.externalUrl}</p>}
          </div>
        )}
      </FormSection>

      {/* Booking & Capacity */}
      {(listingType === 'free_booking' || listingType === 'paid_booking') && (
        <FormSection title="Booking & Capacity" description="Seat and attendee constraints" icon={Users}>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isUnlimitedCapacity}
              onChange={(e) => setIsUnlimitedCapacity(e.target.checked)}
              className="h-4 w-4 rounded border-border/40 bg-input text-primary accent-primary"
              id="unlimitedCapEdit"
            />
            <label htmlFor="unlimitedCapEdit" className="text-sm text-secondary-foreground cursor-pointer">
              Unlimited capacity (no seat limit)
            </label>
          </div>

          {!isUnlimitedCapacity && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel label="Total Capacity" required />
                <Input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                  min={1}
                />
              </div>
              <div>
                <FieldLabel label="Max Per Booking" />
                <Input
                  type="number"
                  value={maxPerBooking}
                  onChange={(e) => setMaxPerBooking(parseInt(e.target.value) || 1)}
                  min={1}
                  max={10}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel label="Registration Opens" />
              <Input
                type="datetime-local"
                value={regOpenDate}
                onChange={(e) => setRegOpenDate(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel label="Registration Closes" />
              <Input
                type="datetime-local"
                value={regCloseDate}
                onChange={(e) => setRegCloseDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <FieldLabel label="Required Attendee Fields" />
            <div className="flex flex-wrap gap-2 mt-1">
              {ATTENDEE_FIELD_OPTIONS.map((field) => {
                const isChecked = requiredFields.includes(field.value);
                return (
                  <button
                    key={field.value}
                    type="button"
                    onClick={() => {
                      setRequiredFields((prev) =>
                        isChecked ? prev.filter((f) => f !== field.value) : [...prev, field.value]
                      );
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      isChecked
                        ? 'bg-primary/15 border-primary/30 text-primary'
                        : 'bg-secondary/10 border-border/20 text-muted-foreground hover:border-primary/20'
                    )}
                  >
                    {field.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowWaitlist}
              onChange={(e) => setAllowWaitlist(e.target.checked)}
              className="h-4 w-4 rounded border-border/40 bg-input text-primary accent-primary"
              id="allowWaitlistEdit"
            />
            <label htmlFor="allowWaitlistEdit" className="text-sm text-secondary-foreground cursor-pointer">
              Allow waitlist when capacity is full
            </label>
          </div>

          <div>
            <FieldLabel label="Cancellation Policy" />
            <Textarea
              value={cancellationPolicy}
              onChange={(e) => setCancellationPolicy(e.target.value)}
              placeholder="Cancellation guidelines..."
              className="min-h-[60px]"
            />
          </div>
        </FormSection>
      )}

      {/* Payment */}
      {listingType === 'paid_booking' && (
        <FormSection title="Payment Configuration" description="Pricing rules" icon={CreditCard}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel label="Amount" required />
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                min={0}
                step={1}
              />
              {errors.paymentAmount && <p className="text-xs text-red-400 mt-1">{errors.paymentAmount}</p>}
            </div>
            <div>
              <FieldLabel label="Currency" />
              <Select
                options={[
                  { value: 'INR', label: 'INR (₹)' },
                  { value: 'USD', label: 'USD ($)' },
                ]}
                value={paymentCurrency}
                onChange={setPaymentCurrency}
              />
            </div>
          </div>
        </FormSection>
      )}

      {/* Display Settings */}
      <FormSection title="Display Settings" description="Order priority & notification" icon={Calendar}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Display Order" />
            <Input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
              min={0}
            />
            <p className="text-xs text-muted-foreground/60 mt-1">Lower numbers appear first (0 = top)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={notifyOnPublish}
            onChange={(e) => setNotifyOnPublish(e.target.checked)}
            className="h-4 w-4 rounded border-border/40 bg-input text-primary accent-primary"
            id="notifyOnPublishEdit"
          />
          <label htmlFor="notifyOnPublishEdit" className="text-sm text-secondary-foreground cursor-pointer">
            Send push notification when published
          </label>
        </div>
      </FormSection>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Button variant="secondary" onClick={() => router.push('/events')} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleUpdate} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

