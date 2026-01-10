/**
 * Firebase Service - Centralized Firebase configuration
 * Uses Firebase JS SDK for cross-platform compatibility (no native dependencies)
 *
 * Note: Only Auth is used on mobile. Firestore access goes through the API.
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCustomToken as firebaseSignInWithCustomToken,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  User,
  Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration from GoogleService-Info.plist
const firebaseConfig = {
  apiKey: 'AIzaSyBXMf9P9oug4vuBE6WJeK1o3dD7ZFmP_EM',
  authDomain: 'escala-simples-482616.firebaseapp.com',
  projectId: 'escala-simples-482616',
  storageBucket: 'escala-simples-482616.firebasestorage.app',
  messagingSenderId: '47416126458',
  appId: '1:47416126458:ios:732d055908300dd5a59243',
};

// Initialize Firebase (only once)
let app: FirebaseApp;
let auth: Auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  // Initialize Auth with AsyncStorage persistence for React Native
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  app = getApps()[0];
  auth = getAuth(app);
}

// =============================================================================
// AUTH SERVICE
// =============================================================================

export const authService = {
  /**
   * Get current user
   */
  getCurrentUser: (): User | null => {
    return auth.currentUser;
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged: (callback: (user: User | null) => void) => {
    return firebaseOnAuthStateChanged(auth, callback);
  },

  /**
   * Sign in with email and password
   */
  signInWithEmail: async (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  },

  /**
   * Create account with email and password
   */
  createAccountWithEmail: async (email: string, password: string) => {
    return createUserWithEmailAndPassword(auth, email, password);
  },

  /**
   * Send password reset email
   */
  sendPasswordResetEmail: async (email: string) => {
    return sendPasswordResetEmail(auth, email);
  },

  /**
   * Sign in with custom token (for employee OTP auth)
   */
  signInWithCustomToken: async (token: string) => {
    return firebaseSignInWithCustomToken(auth, token);
  },

  /**
   * Sign out
   */
  signOut: async () => {
    return firebaseSignOut(auth);
  },

  /**
   * Update user profile
   */
  updateProfile: async (displayName: string) => {
    const user = auth.currentUser;
    if (user) {
      return firebaseUpdateProfile(user, { displayName });
    }
  },

  /**
   * Get ID token for API authentication
   */
  getIdToken: async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (user) {
      return user.getIdToken();
    }
    return null;
  },
};

// =============================================================================
// TYPES
// =============================================================================

export type { User as FirebaseUser };

// Re-export auth types for compatibility
export type FirebaseAuthTypes = {
  User: User;
};
