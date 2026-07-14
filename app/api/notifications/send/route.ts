import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminMessaging } from '@/services/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const bypassFcm = process.env.BYPASS_FCM_FOR_TESTING === 'true';

    // 1. If not bypassed, verify Admin SDK is initialized
    if (!bypassFcm && (!adminAuth || !adminMessaging)) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin SDK not initialized. Set FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, and FIREBASE_PROJECT_ID environment variables.' },
        { status: 500 }
      );
    }

    // 2. Extract and verify authentication token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    let email = 'mock-developer@nirvaha.app';
    let uid = 'mock-uid-12345';

    if (!bypassFcm && adminAuth) {
      const decodedToken = await adminAuth.verifyIdToken(token);
      email = decodedToken.email || '';
      uid = decodedToken.uid;

      if (!email) {
        return NextResponse.json(
          { success: false, error: 'No email found in token payload' },
          { status: 400 }
        );
      }

      // Check permissions
      let isAuthorized = decodedToken.admin === true;
      if (!isAuthorized) {
        const authorizedEmailsStr = process.env.AUTHORIZED_ADMIN_EMAILS || '';
        const authorizedEmails = authorizedEmailsStr
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.length > 0);

        isAuthorized = authorizedEmails.includes(email.toLowerCase());
      }

      if (!isAuthorized) {
        console.warn(`🔒 Unauthorized FCM send attempt blocked for email: ${email}`);
        return NextResponse.json(
          { success: false, error: 'You are not authorized to send notifications' },
          { status: 403 }
        );
      }
    }

    // 3. Parse and validate message payload
    const bodyPayload = await req.json();
    const { title, body, imageUrl, topic, priority, deepLink } = bodyPayload;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Message Title is required.' }, { status: 400 });
    }
    if (!body || !body.trim()) {
      return NextResponse.json({ success: false, error: 'Message Body is required.' }, { status: 400 });
    }
    if (!topic || !topic.trim()) {
      return NextResponse.json({ success: false, error: 'Target Topic destination is required.' }, { status: 400 });
    }

    // 4. Dispatch notification
    console.log(`✉️ Dispatching push: "${title}" to topic "${topic}" by admin "${email}"`);

    if (bypassFcm) {
      // Mock successful transmission
      console.log('🧪 FCM Send bypassed. Dry run mock response sent.');
      return NextResponse.json({
        success: true,
        messageId: `mock-message-id-${Math.random().toString(36).substring(2, 9)}`,
        info: 'MOCK TRANSMISSION SUCCESS (BYPASS_FCM_FOR_TESTING active)',
        payload: {
          title,
          body,
          imageUrl,
          topic,
          priority,
          deepLink,
        }
      });
    }

    // Standard FCM messaging payload structure
    const message: any = {
      notification: {
        title: title.trim(),
        body: body.trim(),
      },
      android: {
        notification: {
          channelId: 'nirvaha_general_broadcast',
          priority: priority === 'high' ? 'high' : 'normal',
        }
      },
      apns: {
        payload: {
          aps: {
            'mutable-content': imageUrl ? 1 : 0,
            sound: 'default',
          }
        }
      },
      data: {},
      topic: topic.trim(),
    };

    // Attach optional image URLs to platforms
    if (imageUrl && imageUrl.trim()) {
      message.android.notification.imageUrl = imageUrl.trim();
      message.apns.fcmOptions = {
        imageUrl: imageUrl.trim(),
      };
      // Web notification image fallback
      message.notification.imageUrl = imageUrl.trim();
    }

    // Attach deep links to payload data
    if (deepLink && deepLink.trim()) {
      message.data.deepLink = deepLink.trim();
    }

    if (adminMessaging) {
      const messageId = await adminMessaging.send(message);
      console.log(`✅ Push successfully delivered to Firebase. Message ID: ${messageId}`);
      return NextResponse.json({
        success: true,
        messageId,
      });
    }

    throw new Error('Firebase Messaging SDK instance missing');

  } catch (error: any) {
    console.error('Error dispatching topic message:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dispatch push notification' },
      { status: 500 }
    );
  }
}
