import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "cj-prom07-strikers.firebaseapp.com",
  projectId: "cj-prom07-strikers",
  storageBucket: "cj-prom07-strikers.firebasestorage.app",
  messagingSenderId: "942220195408",
  appId: "1:942220195408:web:0e22ae3b7603659d384355",
  measurementId: "G-SEL08ZLDP8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logoutUser = () => signOut(auth);
