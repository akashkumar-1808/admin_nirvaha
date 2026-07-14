import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminMessaging } from '@/services/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Admin SDK is initialized on the server
    if (!adminAuth || !adminMessaging) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin SDK not initialized. Verify server environment variables.' },
        { status: 500 }
      );
    }

    // 2. Extract and verify client authorization token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = decodedToken.email || '';

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'No email found in token payload' },
        { status: 400 }
      );
    }

    // Perform permission whitelist validation
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

    // 3. Parse and validate push notification payload
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

    // 4. Build message payload for Firebase Cloud Messaging
    console.log(`✉️ Dispatching live push: "${title}" to topic "${topic}" by admin "${email}"`);

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

    // Attach rich media images to platforms if specified
    if (imageUrl && imageUrl.trim()) {
      message.android.notification.imageUrl = imageUrl.trim();
      message.apns.fcmOptions = {
        imageUrl: imageUrl.trim(),
      };
      message.notification.imageUrl = imageUrl.trim();
    }

    // Attach deep links to payload data
    if (deepLink && deepLink.trim()) {
      message.data.deepLink = deepLink.trim();
    }

    // Deliver through live Firebase Cloud Messaging API
    const messageId = await adminMessaging.send(message);
    console.log(`✅ Push successfully delivered to Firebase. Message ID: ${messageId}`);
    
    return NextResponse.json({
      success: true,
      messageId,
    });

  } catch (error: any) {
    console.error('Error dispatching topic message:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dispatch push notification' },
      { status: 500 }
    );
  }
}
