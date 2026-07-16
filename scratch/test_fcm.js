const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
}

if (!projectId || !clientEmail || !privateKey) {
  console.error('Error: Missing Firebase environment variables.');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey,
  }),
});

const messaging = getMessaging(app);

// Construct the message payload with priority at the android level, not android.notification
const goodMessage = {
  notification: {
    title: 'Test Title',
    body: 'Test Body',
  },
  android: {
    priority: 'normal', // Moved to android config level
    notification: {
      channelId: 'nirvaha_general_broadcast',
    }
  },
  apns: {
    payload: {
      aps: {
        'mutable-content': 0,
        sound: 'default',
      }
    }
  },
  data: {},
  topic: 'all_users',
};

async function run() {
  try {
    console.log('Sending message with dryRun=true...');
    const res = await messaging.send(goodMessage, true);
    console.log('Success! Dry run result:', res);
  } catch (error) {
    console.error('FCM Send Error:', error);
  }
}

run();
