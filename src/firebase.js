/**
 * Firebase Configuration & Initialization — ShadowChat 2.0
 * Uses Firebase v11 CDN modules.
 * Includes Auth, Realtime Database, and Storage.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  getDatabase,
  ref,
  push,
  set,
  update,
  onValue,
  onChildAdded,
  onChildRemoved,
  onChildChanged,
  remove,
  off,
  serverTimestamp,
  query,
  orderByChild,
  limitToLast,
  get,
  child,
  onDisconnect
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// ─── Firebase Configuration ─────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCq0XKRa1b_7b-4d7PuSfoqMTUT0m6s-bA",
  authDomain: "shadowchat-e971c.firebaseapp.com",
  databaseURL: "https://shadowchat-e971c-default-rtdb.firebaseio.com",
  projectId: "shadowchat-e971c",
  storageBucket: "shadowchat-e971c.firebasestorage.app",
  messagingSenderId: "798264373263",
  appId: "1:798264373263:web:071498839917afb904b37a"
};

// ─── Initialize Firebase ────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

// ─── Exports ────────────────────────────────────────────────────────────────────
// Core instances
export { app, auth, db, storage };

// Auth functions
export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword
};

// Database functions
export {
  ref,
  push,
  set,
  update,
  onValue,
  onChildAdded,
  onChildRemoved,
  onChildChanged,
  remove,
  off,
  serverTimestamp,
  query,
  orderByChild,
  limitToLast,
  get,
  child,
  onDisconnect
};

// Storage functions
export {
  storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
};
