/**
 * Firebase Admin SDK Service
 * Centralized Firebase configuration for the API
 */

import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin SDK
function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Check for service account file
  const serviceAccountPath = path.join(__dirname, '../../service-account.json');

  if (fs.existsSync(serviceAccountPath)) {
    // Use service account file (local development)
    const serviceAccount = require(serviceAccountPath);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Use environment variable path
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } else {
    // Use default credentials (Cloud Run with attached service account)
    return admin.initializeApp({
      projectId: process.env.GOOGLE_PROJECT_ID || 'escala-simples-482616',
    });
  }
}

// Initialize
const app = initializeFirebase();

// Exports
export const db = getFirestore(app);
export const auth = getAuth(app);

// Collection references
export const collections = {
  managers: db.collection('managers'),
  establishments: db.collection('establishments'),
  employees: db.collection('employees'),
  schedules: db.collection('schedules'),
  shifts: db.collection('shifts'),
  swapRequests: db.collection('swapRequests'),
  whatsappMessages: db.collection('whatsappMessages'),
};

// Helper to get server timestamp
export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
export const arrayUnion = admin.firestore.FieldValue.arrayUnion;
export const arrayRemove = admin.firestore.FieldValue.arrayRemove;

export default admin;
