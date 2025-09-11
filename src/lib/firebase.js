// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  enableIndexedDbPersistence,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getAnalytics, isSupported as analyticsIsSupported } from "firebase/analytics";

/** ====== Firebase config (theo key bạn cung cấp) ====== */
const firebaseConfig = {
  apiKey: "AIzaSyC5BJnlaNNDdEXjFBvCHkHZWmdpXnyKVhU",
  authDomain: "web-crm-bds.firebaseapp.com",
  projectId: "web-crm-bds",
  storageBucket: "web-crm-bds.firebasestorage.app",
  messagingSenderId: "986042118234",
  appId: "1:986042118234:web:5fbef52e6ecc081528a863",
  measurementId: "G-N1T1S50G43",
};

/** ====== Init App ====== */
export const app = initializeApp(firebaseConfig);

/** ====== Firestore ====== */
export const db = getFirestore(app);

// Bật cache offline (tự đồng bộ khi online lại)
enableIndexedDbPersistence(db).catch((err) => {
  // Thường gặp: FAILED_PRECONDITION (mở nhiều tab) / UNIMPLEMENTED (private mode)
  console.warn("Firestore persistence not enabled:", err?.code || err);
});

/** Helper server time */
export const now = () => serverTimestamp();

/** ====== Auth ====== */
export const auth = getAuth(app);

/** Tự đăng nhập ẩn cho môi trường dev / demo */
export function ensureAuth() {
  // nếu chưa có user, đăng nhập anonymous
  if (!auth.currentUser) {
    signInAnonymously(auth).catch((e) => {
      console.warn("Anonymous sign-in error:", e);
    });
  }
  // giữ phiên đăng nhập “ấm”
  onAuthStateChanged(auth, () => {});
}

/** ====== Analytics (tùy môi trường) ====== */
export let analytics = null;
(async () => {
  try {
    if (typeof window !== "undefined" && (await analyticsIsSupported())) {
      analytics = getAnalytics(app);
    }
  } catch (e) {
    console.warn("Analytics not supported:", e);
  }
})();
