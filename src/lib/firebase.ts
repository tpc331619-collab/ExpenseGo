import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCQvgfKfvl1lbLQcjZo5m35J3ROSxZrii0',
  authDomain: 'purchasego-1df64.firebaseapp.com',
  projectId: 'purchasego-1df64',
  storageBucket: 'purchasego-1df64.firebasestorage.app',
  messagingSenderId: '747091647623',
  appId: '1:747091647623:web:fdf8cabdbe94f06695ac22',
  measurementId: 'G-1D4ZG2BSRE',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
