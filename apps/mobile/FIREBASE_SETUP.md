# Firebase Configuration Setup

This document explains how to set up Firebase configuration files for the mobile app.

## Required Files

The following files are required but **NOT committed to git** (they contain API keys):

- `google-services.json` - Android Firebase configuration
- `GoogleService-Info.plist` - iOS Firebase configuration

## Setup Instructions

### 1. Download from Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`escala-simples-482616`)
3. Click the gear icon > **Project Settings**
4. Scroll down to **Your apps**

#### For Android:
1. Click on the Android app
2. Click **google-services.json** download button
3. Save as `apps/mobile/google-services.json`

#### For iOS:
1. Click on the iOS app
2. Click **GoogleService-Info.plist** download button
3. Save as `apps/mobile/GoogleService-Info.plist`

### 2. Verify Files are Ignored

Run this command to ensure the files won't be committed:

```bash
git check-ignore apps/mobile/google-services.json
git check-ignore apps/mobile/GoogleService-Info.plist
```

Both commands should output the file path, confirming they're ignored.

### 3. Example Templates

Reference files are provided:
- `google-services.json.example`
- `GoogleService-Info.plist.example`

These show the structure but contain placeholder values.

## Security Notes

- **NEVER** commit actual Firebase config files to git
- If you accidentally commit secrets, rotate ALL API keys immediately
- The `.gitignore` is configured to prevent this, but always verify

## Regenerating API Keys

If your keys were exposed:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your project
3. Under **API Keys**, find the compromised key
4. Click on it > **Regenerate Key**
5. Download new `google-services.json` and `GoogleService-Info.plist` from Firebase Console
6. Replace local files with new ones

## For CI/CD

Store Firebase config as base64-encoded secrets:

```bash
# Encode
base64 -i google-services.json | pbcopy

# In CI, decode and write
echo $GOOGLE_SERVICES_JSON | base64 -d > apps/mobile/google-services.json
```
