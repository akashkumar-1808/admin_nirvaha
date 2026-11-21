import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { EventDocument } from '../../types/events';
import { fetchEvents } from '../../services/eventsService';
import { EventCard } from '../events/EventCard';

export const EventsRail: React.FC = () => {
  const router = useRouter();
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      // Fetch published upcoming events for the rail
      const data = await fetchEvents({
        status: 'published',
        limit: 8,
      });

      // Prioritize featured events first, then sort by startDate
      const sorted = [...data].sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        const dateA = new Date(a.schedule?.startDate || 0).getTime();
        const dateB = new Date(b.schedule?.startDate || 0).getTime();
        return dateA - dateB;
      });

      setEvents(sorted);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleViewAll = () => {
    router.push('/events' as any);
  };

  // If error or empty and not loading, don't break the home screen layout
  if (!isLoading && (hasError || events.length === 0)) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(400).springify()}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Upcoming Experiences</Text>
          <Text style={styles.subtitle}>
            Sacred gatherings & wellness journeys
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.viewAllButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleViewAll}
          accessibilityRole="button"
          accessibilityLabel="View all upcoming experiences"
        >
          <Text style={styles.viewAllText}>View All</Text>
          <ChevronRight size={14} color="#D4AF37" />
        </Pressable>
      </View>

      {/* Rail Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#D4AF37" />
          <Text style={styles.loadingText}>Gathering sacred journeys...</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              variant="rail"
              onPress={() => router.push(('/events/' + event.id) as any)}
            />
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_400Regular',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  viewAllText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#D4AF37',
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  loadingContainer: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
