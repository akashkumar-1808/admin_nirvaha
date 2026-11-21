import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  Globe,
  User,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  Users,
} from 'lucide-react-native';
import {
  EventDocument,
  getComputedEventStatus,
  isEventBookable,
} from '../../../types/events';
import { fetchEventById } from '../../../services/eventsService';
import { StatusBadge } from '../../../components/events/StatusBadge';

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [event, setEvent] = useState<EventDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await fetchEventById(id);
      if (!data) {
        setErrorMessage('This event could not be found or has been removed.');
      } else {
        setEvent(data);
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Unable to load event details. Please check your connection and retry.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/events' as any);
    }
  };

  const handleExternalLink = async (url?: string) => {
    if (!url) {
      Alert.alert('Notice', 'No external link is configured for this event.');
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unable to Open Link', 'The provided URL cannot be opened: ' + url);
      }
    } catch {
      Alert.alert('Error', 'Failed to open the external link.');
    }
  };

  const handleBookFree = () => {
    if (!event) return;
    router.push(('/events/' + event.id + '/register') as any);
  };

  // Safe Date Formatting
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return 'Date TBD';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Date TBD';
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Date TBD';
    }
  };

  const formatTimeOnly = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>Retrieving sacred journey details...</Text>
      </View>
    );
  }

  // Error / Not Found State
  if (errorMessage || !event) {
    return (
      <View style={[styles.container, styles.centerContainer, { paddingTop: insets.top }]}>
        <AlertTriangle size={48} color="#EF4444" style={styles.errorIcon} />
        <Text style={styles.errorTitle}>Unable to Display Event</Text>
        <Text style={styles.errorDescription}>
          {errorMessage || 'The requested event is currently unavailable.'}
        </Text>
        <View style={styles.errorActionRow}>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={handleBack}
          >
            <ChevronLeft size={16} color="#FFFFFF" />
            <Text style={styles.secondaryButtonText}>Back to Experiences</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={loadEvent}
          >
            <RotateCcw size={16} color="#0A0A0A" />
            <Text style={styles.primaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const computedStatus = getComputedEventStatus(event);
  const bookable = isEventBookable(event);

  const startDateFormatted = formatDateTime(event.schedule?.startDate);
  const startTimeFormatted = formatTimeOnly(event.schedule?.startDate);
  const endTimeFormatted = formatTimeOnly(event.schedule?.endDate);
  const durationText = event.schedule?.durationMinutes
    ? `${event.schedule.durationMinutes} minutes`
    : null;

  const isOnline = event.location?.type === 'online';
  const coverUrl =
    event.media?.coverImageUrl ||
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80';

  const capacity = event.bookingConfig?.capacity || 0;
  const attendeeCount = event.attendeeCount || 0;
  const remainingSpots = Math.max(0, capacity - attendeeCount);

  // Dynamic Primary Action Bar Rendering
  const renderPrimaryAction = () => {
    // 1. Advertisement
    if (event.listingType === 'advertisement') {
      const externalUrl = event.bookingConfig?.externalUrl;
      return (
        <View style={styles.actionContainer}>
          <View style={styles.actionInfoBanner}>
            <Info size={16} color="rgba(255, 255, 255, 0.7)" />
            <Text style={styles.actionInfoText}>Informational Showcase</Text>
          </View>
          {externalUrl ? (
            <Pressable
              style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
              onPress={() => handleExternalLink(externalUrl)}
              accessibilityRole="button"
              accessibilityLabel="Visit external website"
            >
              <Text style={styles.actionButtonText}>Learn More</Text>
              <ExternalLink size={16} color="#0A0A0A" />
            </Pressable>
          ) : null}
        </View>
      );
    }

    // 2. External Registration
    if (event.listingType === 'external_registration') {
      const extUrl = event.bookingConfig?.externalUrl || event.location?.meetingUrl;
      return (
        <View style={styles.actionContainer}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
            onPress={() => handleExternalLink(extUrl)}
            accessibilityRole="button"
            accessibilityLabel="Register on external partner site"
          >
            <Text style={styles.actionButtonText}>Register on Partner Site</Text>
            <ExternalLink size={16} color="#0A0A0A" />
          </Pressable>
        </View>
      );
    }

    // 3. Paid Booking (Strictly Safeguarded - Unavailable)
    if (event.listingType === 'paid_booking') {
      const currency = event.paymentConfig?.currency || '₹';
      const amount = event.paymentConfig?.amount ?? 0;
      return (
        <View style={styles.actionContainer}>
          <View style={styles.paidPriceRow}>
            <Text style={styles.paidPriceLabel}>Registration Fee</Text>
            <Text style={styles.paidPriceAmount}>
              {currency} {amount}
            </Text>
          </View>
          <Pressable
            style={[styles.actionButton, styles.actionButtonDisabled]}
            disabled={true}
            accessibilityRole="button"
            accessibilityLabel="Booking currently unavailable"
          >
            <Text style={styles.actionButtonDisabledText}>
              Booking Currently Unavailable
            </Text>
          </Pressable>
          <Text style={styles.paidNotice}>
            Paid booking integration is being verified for production. In-app checkout is currently closed.
          </Text>
        </View>
      );
    }

    // 4. Free Booking
    if (event.listingType === 'free_booking') {
      if (bookable) {
        return (
          <View style={styles.actionContainer}>
            <View style={styles.freeBadgeRow}>
              <View style={styles.freePill}>
                <Text style={styles.freePillText}>Free Experience</Text>
              </View>
              {capacity > 0 && (
                <Text style={styles.spotsRemainingText}>
                  {remainingSpots} spot{remainingSpots === 1 ? '' : 's'} left
                </Text>
              )}
            </View>
            <Pressable
              style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
              onPress={handleBookFree}
              accessibilityRole="button"
              accessibilityLabel="Book Free Experience"
            >
              <Text style={styles.actionButtonText}>Book Free Experience</Text>
            </Pressable>
          </View>
        );
      }

      // Ineligible free booking states
      let disabledLabel = 'Registration Closed';
      if (computedStatus === 'cancelled') disabledLabel = 'Event Cancelled';
      else if (computedStatus === 'archived') disabledLabel = 'Event Concluded';
      else if (computedStatus === 'fully_booked') disabledLabel = 'Fully Booked (Sold Out)';

      return (
        <View style={styles.actionContainer}>
          <Pressable
            style={[styles.actionButton, styles.actionButtonDisabled]}
            disabled={true}
            accessibilityRole="button"
            accessibilityLabel={disabledLabel}
          >
            <Text style={styles.actionButtonDisabledText}>{disabledLabel}</Text>
          </Pressable>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover Image Header */}
        <View style={styles.heroWrapper}>
          <Image
            source={{ uri: coverUrl }}
            style={styles.heroImage}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={['rgba(10, 10, 10, 0.4)', 'rgba(10, 10, 10, 0.2)', '#0A0A0A']}
            locations={[0, 0.5, 1]}
            style={styles.heroGradient}
          />

          {/* Floating Back Button */}
          <View style={[styles.floatingHeader, { top: Math.max(insets.top + 6, 20) }]}>
            <Pressable
              style={({ pressed }) => [styles.floatingBackButton, pressed && styles.buttonPressed]}
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Back to Events"
            >
              <ChevronLeft size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Badges on Hero Bottom */}
          <View style={styles.heroBadges}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {event.category?.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            <StatusBadge status={computedStatus} size="md" />
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.contentBody}>
          {/* Event Title */}
          <Text style={styles.eventTitle}>{event.title}</Text>

          {/* Short Description */}
          {event.shortDescription ? (
            <Text style={styles.eventSubtitle}>{event.shortDescription}</Text>
          ) : null}

          {/* Schedule & Timing Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.iconCircle}>
                <Calendar size={18} color="#D4AF37" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{startDateFormatted}</Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View style={styles.iconCircle}>
                <Clock size={18} color="#D4AF37" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Time & Duration</Text>
                <Text style={styles.infoValue}>
                  {startTimeFormatted}
                  {endTimeFormatted ? ` – ${endTimeFormatted}` : ''}
                  {durationText ? ` (${durationText})` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Location Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.iconCircle}>
                {isOnline ? (
                  <Globe size={18} color="#2D5A4C" />
                ) : (
                  <MapPin size={18} color="#2D5A4C" />
                )}
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>
                  {isOnline ? 'Online Gathering' : 'In-Person Sanctuary'}
                </Text>
                <Text style={styles.infoValue}>
                  {isOnline
                    ? 'Virtual Meeting'
                    : event.location?.venueName || 'Sanctuary Space'}
                </Text>
                {event.location?.address ? (
                  <Text style={styles.infoSubValue}>{event.location.address}</Text>
                ) : null}
                {event.location?.accessInstructions ? (
                  <Text style={styles.infoSubValue}>
                    {event.location.accessInstructions}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Capacity & Availability */}
          {capacity > 0 && (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.iconCircle}>
                  <Users size={18} color="#D4AF37" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Gathering Capacity</Text>
                  <Text style={styles.infoValue}>
                    {attendeeCount} of {capacity} spots filled
                  </Text>
                  {bookable && (
                    <Text style={styles.infoSubValue}>
                      {remainingSpots} available spots remaining
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Full Description Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>About This Experience</Text>
            <Text style={styles.fullDescriptionText}>
              {event.fullDescription || event.shortDescription}
            </Text>
          </View>

          {/* Organizer / Guide Section */}
          {event.organizer?.name ? (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Your Guide</Text>
              <View style={styles.organizerCard}>
                <View style={styles.organizerAvatar}>
                  <User size={22} color="#D4AF37" />
                </View>
                <View style={styles.organizerContent}>
                  <Text style={styles.organizerName}>{event.organizer.name}</Text>
                  {event.organizer.email ? (
                    <Text style={styles.organizerEmail}>{event.organizer.email}</Text>
                  ) : null}
                  {event.organizer.bio ? (
                    <Text style={styles.organizerBio}>{event.organizer.bio}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {/* Policies & Notes */}
          {event.bookingConfig?.cancellationPolicy ? (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Cancellation Policy</Text>
              <Text style={styles.policyText}>
                {event.bookingConfig.cancellationPolicy}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Floating Bottom Primary Action Bar */}
      <View style={[styles.bottomBarWrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {renderPrimaryAction()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scrollArea: {
    flex: 1,
  },
  heroWrapper: {
    width: '100%',
    height: 320,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingHeader: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  floatingBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(10, 10, 10, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroBadges: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    backgroundColor: 'rgba(10, 10, 10, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.5,
  },
  contentBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  eventTitle: {
    fontSize: 26,
    fontFamily: 'PlayfairDisplay_400Regular',
    color: '#FFFFFF',
    lineHeight: 34,
    marginBottom: 8,
  },
  eventSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 21,
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  infoDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  infoSubValue: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
    lineHeight: 17,
  },
  sectionContainer: {
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_400Regular',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  fullDescriptionText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 23,
  },
  organizerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 14,
  },
  organizerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  organizerContent: {
    flex: 1,
  },
  organizerName: {
    fontSize: 15,
    fontFamily: 'PlayfairDisplay_400Regular',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  organizerEmail: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 6,
  },
  organizerBio: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
  },
  policyText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 18,
  },
  // Bottom Bar & Action Styles
  bottomBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  actionContainer: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4AF37',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  actionButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  actionButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#0A0A0A',
  },
  actionButtonDisabledText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  actionInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingBottom: 4,
  },
  actionInfoText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  freeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  freePill: {
    backgroundColor: 'rgba(45, 90, 76, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(45, 90, 76, 0.8)',
  },
  freePillText: {
    color: '#A3BDB1',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  spotsRemainingText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  paidPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paidPriceLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  paidPriceAmount: {
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_400Regular',
    color: '#D4AF37',
  },
  paidNotice: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
    lineHeight: 15,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  loadingText: {
    marginTop: 14,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_400Regular',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDescription: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  errorActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D4AF37',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#0A0A0A',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
  },
});
