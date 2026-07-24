const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

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

const auth = getAuth(app);

const email = '245125748002@mvsrec.edu.in';
const password = 'NirvahaTest123!';

async function createUser() {
  try {
    console.log(`Checking if user ${email} already exists...`);
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`User already exists. UID: ${userRecord.uid}. Resetting password...`);
      await auth.updateUser(userRecord.uid, {
        password: password
      });
      console.log(`Password successfully updated!`);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log(`User does not exist. Creating user...`);
        userRecord = await auth.createUser({
          email: email,
          password: password,
          emailVerified: true,
          displayName: 'Test User',
        });
        console.log(`Successfully created new user!`);
      } else {
        throw e;
      }
    }
    
    console.log(`\nUser Credentials:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (error) {
    console.error('Failed to create/update user:', error);
  }
}

createUser();
