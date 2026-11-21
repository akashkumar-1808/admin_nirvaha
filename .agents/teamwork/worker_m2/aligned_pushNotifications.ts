import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { Router } from 'expo-router';

// Configure notification handling for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Normalizes deep link URLs matching Team 1 contract.
 * Supports:
 * - nirvaha://events/[id] -> /events/[id]
 * - nirvahaapp://events/[id] -> /events/[id]
 * - /events/[id] -> /events/[id]
 * - Legacy routes: nirvaha://music -> /collection, nirvaha://sleep -> /(tabs)/wellness, nirvaha://companions -> /chat
 */
export function parseDeepLink(rawLink?: string): string | null {
  if (!rawLink || typeof rawLink !== 'string') return null;

  let link = rawLink.trim();

  // Strip scheme prefixes
  if (link.startsWith('nirvaha://')) {
    link = link.replace('nirvaha://', '/');
  } else if (link.startsWith('nirvahaapp://')) {
    link = link.replace('nirvahaapp://', '/');
  }

  // Ensure leading slash
  if (!link.startsWith('/')) {
    link = `/${link}`;
  }

  // Legacy mappings
  if (link === '/music') return '/collection';
  if (link === '/sleep') return '/(tabs)/wellness';
  if (link === '/ai' || link === '/companions') return '/chat';

  // Events deep linking format: /events/[id] or /events
  return link;
}

export const initializePushNotifications = (router: Router) => {
  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('nirvaha_general_broadcast', {
          name: 'General Broadcast',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Firebase Messaging permission authorized:', authStatus);
        // Subscribe to global announcements topic
        await messaging().subscribeToTopic('all_users');
      }
    } catch (error) {
      console.warn('Error setting up push notifications:', error);
    }
  };

  requestPermissions();

  const handleDeepLinkFromData = (data?: Record<string, any>) => {
    const rawLink = data?.deepLink || data?.url || data?.link;
    const targetRoute = parseDeepLink(rawLink);
    if (targetRoute) {
      console.log('[PushNotifications] Routing to target route:', targetRoute);
      router.push(targetRoute as any);
    }
  };

  // 1. Foreground FCM message receive handler
  const unsubscribeForegroundMessage = messaging().onMessage(async (remoteMessage) => {
    console.log('Foreground FCM Message received:', remoteMessage);
    if (remoteMessage.notification) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification.title || 'Nirvaha',
          body: remoteMessage.notification.body || '',
          data: remoteMessage.data || {},
        },
        trigger: null, // deliver immediately
      });
    }
  });

  // 2. Foreground local notification click / response listener (Expo Notifications)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response?.notification?.request?.content?.data;
      handleDeepLinkFromData(data);
    }
  );

  // 3. Background notification click (Firebase Messaging)
  const unsubscribeNotificationOpened = messaging().onNotificationOpenedApp(
    (remoteMessage) => {
      console.log('Notification caused app to open from background state:', remoteMessage);
      handleDeepLinkFromData(remoteMessage.data);
    }
  );

  // 4. Cold launch notification click (Firebase Messaging)
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log('Notification caused app to open from cold launch state:', remoteMessage);
        handleDeepLinkFromData(remoteMessage.data);
      }
    });

  // Clean up all registered listeners
  return () => {
    unsubscribeForegroundMessage();
    unsubscribeNotificationOpened();
    responseSubscription.remove();
  };
};
