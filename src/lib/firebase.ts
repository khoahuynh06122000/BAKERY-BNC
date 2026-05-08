import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

function initFirebase() {
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || "(default)");
    const auth = getAuth(app);
    return { app, db, auth };
  } catch (error) {
    console.error("Critical Firebase Initialization Failure:", error);
    // Fallback to minimal setup if possible, or re-throw
    throw error;
  }
}

const { app, db, auth } = initFirebase();
export { app, db, auth };
