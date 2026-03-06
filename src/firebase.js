import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAJqZ04ON-lsX2_08ET6CMUAZzxvbHsUpc",
    authDomain: "ai-life-coach-694f9.firebaseapp.com",
    projectId: "ai-life-coach-694f9",
    storageBucket: "ai-life-coach-694f9.appspot.com",
    messagingSenderId: "328321656985",
    appId: "1:328321656985:web:041c0d8585741cdcbdb008",
    measurementId: "G-K75Q06YF6X"
  };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});
