# Escala Simples - AI Agent Handover Document

**Last Updated:** January 12, 2026
**Project:** Escala Simples - Scheduling System for Brazilian Restaurants & Retail
**Status:** In Development (MVP Phase)
**Framework:** Ralph Autonomous Development

---

## 1. Project Overview

### What is Escala Simples?

A Nubank-inspired scheduling system for Brazilian restaurants and retail businesses. The product aims to:
- Automatically collect employee availability restrictions
- Generate optimized schedules using AI (Gemini 2.5 Flash)
- Facilitate shift swaps between employees
- Notify everyone automatically about changes

### Key Users

| User Type | Description | Interface |
|-----------|-------------|-----------|
| Manager (Gerente) | Restaurant/store owner or manager | Mobile App (iOS/Android) |
| Employee (Funcionário) | Hourly worker | Mobile App (simplified) |

### Core Value Proposition

```
MANAGER: "Configure once, approve when needed."
EMPLOYEE: "Tell us when you can't work, swap with colleagues."
```

---

## 2. Tech Stack

### Frontend (Mobile App)
- **Framework:** React Native + Expo (SDK 52)
- **Navigation:** expo-router (file-based routing)
- **Language:** TypeScript
- **Authentication:** Firebase Auth for managers, PIN-based for employees
- **Animations:** react-native-reanimated
- **Haptics:** expo-haptics
- **Visual Effects:** expo-blur

### Backend (API)
- **Runtime:** Node.js + Express
- **Language:** TypeScript
- **Database:** Firebase Firestore
- **Authentication:** Firebase Admin SDK (custom tokens for employees)
- **Validation:** Zod schemas
- **AI:** Gemini 2.5 Flash (for NLP settings changes and schedule generation)

### Infrastructure
- **GCP Project:** `escala-simples-482616`
- **Auth:** Firebase Authentication (Email/Password for managers, Custom tokens for employees)
- **Database:** Firestore with composite indexes

---

## 3. Current Project Status (January 2026)

### What's Working

| Feature | Status | Notes |
|---------|--------|-------|
| Manager Authentication | ✅ Working | Email/password via Firebase |
| Employee Authentication | ✅ Working | **PIN-based login** (simplified from OTP) |
| Establishment Onboarding | ✅ Working | 5-step flow complete |
| Team Management | ✅ Working | Add/edit/remove employees with PIN generation |
| Employee Invitations | ✅ Working | **Native share** (WhatsApp/SMS/Email via phone share sheet) |
| Employee Home Screen | ✅ Working | Shows upcoming shifts |
| Settings (AI Chat) | ✅ Working | Gemini-powered settings changes |
| AI Schedule Generation | ✅ Working | Gemini-powered with CLT validation |
| Schedule View | ✅ Working | Manager and employee views |

### Recent Work Completed (January 12, 2026)

#### Simplified Employee Invitation & Login Flow

Replaced complex WhatsApp Business API integration with simpler alternatives:

1. **Native Share for Invitations** (replaces WhatsApp Business API)
   - Managers now use phone's native share sheet to send invites
   - Can share via WhatsApp, SMS, Email, or any installed app
   - No Meta Business account or API tokens required
   - No per-message costs

2. **PIN-based Employee Login** (replaces OTP via WhatsApp)
   - 6-digit PIN generated when employee is created
   - PIN returned to manager once, who shares it with employee
   - Employee logs in with phone + PIN
   - Instant login, no waiting for OTP messages

3. **Files Modified:**
   - `apps/mobile/src/services/share.ts` (NEW) - Native share functionality
   - `apps/mobile/app/(tabs)/team.tsx` - Added invite button
   - `apps/mobile/app/(employee)/login.tsx` - Redesigned for PIN entry
   - `apps/mobile/src/hooks/useEmployeeAuth.tsx` - Added `loginWithPin()`
   - `apps/mobile/src/services/api.ts` - Added `pinLogin()`, `createInviteToken()`
   - `apps/api/src/routes/employees.ts` - Added PIN generation, PIN login endpoint
   - `apps/api/src/routes/invites.ts` - Added create-token endpoint

### Previous Work

1. **Access Control Separation** - Manager and employee views properly separated
2. **Employee Authentication Flow** - Now PIN-based (see above)
3. **Firestore Indexes** - Deployed required composite indexes
4. **Security Fix (Jan 9, 2026)** - Fixed leaked Firebase API keys
5. **AI Schedule Generation** - Fully implemented with Gemini 2.5 Flash

---

## 4. Route Structure

```
apps/mobile/app/
├── _layout.tsx              # Root layout with all route groups
├── index.tsx                # Splash screen (checks auth, routes appropriately)
├── (auth)/                  # Manager authentication
│   ├── _layout.tsx
│   ├── login.tsx            # Has "Sou funcionário" link
│   ├── signup.tsx
│   └── forgot-password.tsx
├── (onboarding)/            # Manager onboarding (5 steps)
│   ├── _layout.tsx
│   ├── name.tsx
│   ├── hours.tsx
│   ├── settings.tsx
│   ├── team.tsx
│   └── complete.tsx
├── (tabs)/                  # Manager main app
│   ├── _layout.tsx
│   ├── index.tsx            # Dashboard
│   ├── team.tsx             # Team management + invite via share
│   ├── schedule.tsx         # Schedule view
│   └── settings.tsx         # AI chat settings
└── (employee)/              # Employee screens
    ├── _layout.tsx
    ├── login.tsx            # PIN login (phone + 6-digit PIN)
    ├── home.tsx             # Employee dashboard
    └── availability.tsx     # Set availability
```

---

## 5. Key Architecture Decisions

### 1. Dual Authentication System
- **Managers:** Firebase Auth (email/password) - full access to establishment
- **Employees:** PIN-based login with Firebase custom tokens - limited access

### 2. Simplified Invitation Flow
- **Native Share:** Uses phone's share functionality instead of WhatsApp Business API
- **No External Dependencies:** No Meta approval, no API tokens, no costs

### 3. Apple Human Interface Guidelines (HIG)
All UI follows Apple HIG principles (see CLAUDE.md for details).

### 4. Gemini for NLP and Schedule Generation
- Settings can be changed via natural language
- AI generates optimal schedules respecting CLT labor laws
- Fallback to round-robin when Gemini unavailable

### 5. Brazilian Localization
- All user-facing text in Portuguese
- Phone mask: `(XX) XXXXX-XXXX`
- International format: `5511999999999`

---

## 6. AI Schedule Generation (Implemented)

The system uses Gemini 2.5 Flash for intelligent schedule generation:

### How It Works

1. **Input:** Week start date, operating hours, employees with restrictions
2. **Processing:** Gemini generates optimal shift assignments
3. **Validation:** Schedule validated against CLT labor laws
4. **Output:** Draft schedule with warnings/errors

### CLT Validation Rules
- Minimum 1 day off per week (DSR)
- Maximum 6 consecutive work days
- Minimum 11-hour rest between shifts
- Maximum 44 hours per week
- Minimum employees per shift

### Key Files
- `apps/api/src/services/gemini.ts` - AI schedule generation
- `apps/api/src/services/scheduleValidator.ts` - CLT validation
- `apps/api/src/routes/schedules.ts` - API endpoints

---

## 7. Development Setup

### Running Locally

```bash
# Terminal 1: Start API
cd /Volumes/Extreme\ Pro/myprojects/Payroll/escala-simples
npm run dev --workspace=escala-simples-api

# Terminal 2: Start Expo
cd /Volumes/Extreme\ Pro/myprojects/Payroll/escala-simples
npm run start --workspace=escala-simples-mobile
```

Or from the apps directories:
```bash
# API
cd apps/api && npm run dev

# Mobile
cd apps/mobile && npx expo start
```

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| `EADDRINUSE: port 3001` | Old API process running | `lsof -i :3001` then `kill <PID>` |
| `EADDRINUSE: port 8081` | Old Expo process running | `lsof -i :8081` then `kill <PID>` |
| React version mismatch | Monorepo hoisting | Already fixed with `overrides` in root package.json |
| "Query requires index" | Missing Firestore index | `npx firebase deploy --only firestore:indexes` |
| App stuck on "Carregando..." | API not running or index missing | Check API logs, deploy indexes |

### Verifying Everything Works

```bash
# Check API health
curl http://localhost:3001/health

# Test PIN login endpoint
curl -X POST http://localhost:3001/employees/pin-login \
  -H "Content-Type: application/json" \
  -d '{"phone": "11999999999", "pin": "123456"}'

# Check Expo bundler
curl http://localhost:8081/status
```

---

## 8. Firestore Collections

```
establishments/
  {establishmentId}/
    name: string
    type: 'restaurant' | 'store' | 'bar' | 'other'
    ownerId: string (Firebase Auth UID)
    operatingHours: { [day: number]: { isOpen, openTime, closeTime } }
    settings: {
      minEmployeesPerShift: number
      swapsAllowed: boolean
      swapsRequireApproval: boolean
      maxSwapsPerMonth: number
      shiftDefinitions?: ShiftDefinition[]
    }
    status: 'pending' | 'active'
    onboardingStep: number | null
    createdAt, updatedAt: Timestamp

employees/
  {employeeId}/
    establishmentId: string
    name: string
    phone: string (formatted: 5511999999999)
    pinHash: string (SHA256 hashed PIN for login)
    status: 'pending' | 'active' | 'inactive'
    inviteStatus: 'pending' | 'sent' | 'completed' | 'expired'
    inviteSentAt, inviteToken, inviteExpiresAt, inviteCompletedAt
    restrictions: {
      unavailableDays: number[]
      unavailableTimeRanges: { day, startTime, endTime }[]
      maxHoursPerWeek: number
      preferredShifts: string[]
      notes: string
    }
    recurringAvailability?: { [dayOfWeek]: { available, startTime?, endTime? } }
    temporaryAvailability?: Array<{ id, startDate, endDate, type, reason? }>
    createdAt, updatedAt: Timestamp

invites/
  {inviteToken}/
    employeeId, establishmentId, token: string
    createdAt, expiresAt: Timestamp
    used: boolean
    usedAt?: Timestamp

schedules/
  {scheduleId}/
    establishmentId: string
    weekStartDate: string (YYYY-MM-DD)
    weekEndDate: string
    status: 'draft' | 'published' | 'archived'
    generatedBy: 'ai' | 'manual'
    shifts: Shift[]
    createdAt, updatedAt, publishedAt: Timestamp
```

---

## 9. API Endpoints

### Establishment (`/establishment`)
- `GET /` - Get current establishment
- `GET /list` - List all user's establishments
- `POST /` - Create establishment
- `PUT /` - Update establishment
- `PATCH /operating-hours` - Update operating hours
- `PATCH /settings` - Update settings
- `POST /activate` - Activate establishment
- `POST /chat` - AI settings interpretation (Gemini)
- `POST /chat/apply` - Apply AI-suggested changes

### Employees (`/employees`)
- `GET /` - List employees
- `POST /` - Add employee (returns PIN once)
- `POST /batch` - Add multiple employees
- `PUT /:id` - Update employee
- `DELETE /:id` - Remove employee
- `POST /pin-login` - **Employee PIN login (public)**
- `POST /:id/regenerate-pin` - Generate new PIN for employee

### Invites (`/invites`)
- `POST /send` - Send WhatsApp invite (legacy)
- `POST /create-token` - **Create invite token for native share**
- `POST /send-bulk` - Bulk send invites
- `POST /resend/:id` - Resend invite
- `GET /validate/:token` - Validate token (public)
- `POST /submit-restrictions` - Submit restrictions (public)

### Schedules (`/schedules`)
- `GET /` - List schedules
- `GET /week/:weekStartDate` - Get schedule for specific week
- `POST /generate` - **Generate AI schedule**
- `PUT /:id` - Update schedule
- `POST /:id/publish` - Publish schedule
- `DELETE /:id` - Delete schedule

### Employee Schedule (`/employee/schedule`)
- `GET /` - Get employee's schedules
- `GET /week/:weekStartDate` - Get employee's week schedule
- `GET /upcoming` - Get upcoming shifts

---

## 10. Important Files Reference

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project guidelines, design system, API docs |
| `handover.md` | This file - AI agent onboarding |
| `firestore.indexes.json` | Firestore composite indexes |
| `apps/api/src/index.ts` | Express server entry point |
| `apps/api/src/services/gemini.ts` | Gemini AI service (schedule + settings) |
| `apps/api/src/services/scheduleValidator.ts` | CLT validation |
| `apps/api/src/routes/employees.ts` | Employee routes + PIN login |
| `apps/api/src/routes/schedules.ts` | Schedule routes + AI generation |
| `apps/mobile/src/services/api.ts` | API client |
| `apps/mobile/src/services/share.ts` | Native share functionality |
| `apps/mobile/src/hooks/useEstablishment.tsx` | Establishment state |
| `apps/mobile/src/hooks/useEmployeeAuth.tsx` | Employee auth hook (PIN-based) |
| `apps/mobile/app/(employee)/login.tsx` | PIN login screen |
| `apps/mobile/FIREBASE_SETUP.md` | Firebase config setup instructions |

---

## 11. User Flows

### Manager Inviting Employee

```
1. Manager goes to Team tab
2. Taps employee card → taps paper-plane icon
3. Native share sheet opens
4. Manager selects WhatsApp/SMS/Email
5. Pre-filled message with invite link is ready
6. Manager taps send
```

### Employee Login

```
1. Employee opens app → "Sou funcionário"
2. Enters phone number
3. Enters 6-digit PIN (received from manager)
4. Taps "Entrar"
5. Logged in immediately
```

### Manager Creating Employee

```
1. Manager taps "Add Employee" in Team tab
2. Enters employee name and phone
3. System generates 6-digit PIN
4. PIN shown to manager once (to share with employee)
5. Manager can use share button to send PIN
```

---

## 12. Next Steps for New Agent

### Current State
The MVP is largely complete with:
- Manager and employee authentication
- Team management with PIN-based employee onboarding
- AI-powered schedule generation
- Settings management via AI chat

### Potential Enhancements

1. **Shift Swap System:**
   - Employee requests swap
   - Another employee accepts
   - Manager approves (optional)
   - Notifications sent

2. **Schedule Publishing Workflow:**
   - Manager reviews AI-generated schedule
   - Makes manual adjustments if needed
   - Publishes schedule
   - Employees notified

3. **Employee Availability UI:**
   - Better recurring availability input
   - Calendar for temporary exceptions
   - Integration with schedule generation

4. **QR Code Invitations:**
   - In-person onboarding
   - Manager shows QR, employee scans

---

## 13. Key Reminders

- **All UI:** Follow Apple HIG (see CLAUDE.md)
- **User messages:** Always in Portuguese
- **Code:** Always in English
- **AI model:** Use Gemini 2.5 Flash exclusively (no Claude/GPT in backend)
- **Package manager:** npm only (not yarn or pnpm)
- **Verification:** Always test changes locally before marking complete
- **TypeScript:** Run `npx tsc --noEmit` before committing
- **Employee Auth:** PIN-based, not OTP

---

## 14. Questions? Check:

1. `CLAUDE.md` - Design guidelines, code patterns, common mistakes
2. `.taskmaster/docs/prd.txt` - Product requirements
3. This file - Project status and architecture

---

*Handover document maintained for continuity between AI coding agents.*
