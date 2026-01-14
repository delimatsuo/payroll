import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// In production, credentials are automatically loaded from GOOGLE_APPLICATION_CREDENTIALS
// In development, you can provide a service account key file
if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Use default credentials (for Cloud Run, GCE, etc.)
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
}

export const auth = admin.auth();
export const adminAuth = auth; // Alias for admin auth operations
export const db = admin.firestore();

// Collection references
export const collections = {
  establishments: db.collection('establishments'),
  employees: db.collection('employees'),
  schedules: db.collection('schedules'),
  swapRequests: db.collection('swapRequests'),
  invites: db.collection('invites'),
  // Employee authentication
  employeeUsers: db.collection('employeeUsers'),
  otpCodes: db.collection('otpCodes'),
  // Employee web tokens
  employeeTokens: db.collection('employeeTokens'),
};

export default admin;
