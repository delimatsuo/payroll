# Escala Simples - AI Agent Handover Document

**Last Updated:** January 9, 2026
**Project:** Escala Simples - Scheduling System for Brazilian Restaurants & Retail
**Status:** In Development (MVP Phase)

---

## 1. Project Overview

### What is Escala Simples?

A Nubank-inspired scheduling system for Brazilian restaurants and retail businesses. The product aims to:
- Automatically collect employee availability restrictions via WhatsApp
- Generate optimized schedules using AI (Gemini 2.5 Flash)
- Facilitate shift swaps between employees
- Notify everyone automatically about changes

### Key Users

| User Type | Description | Interface |
|-----------|-------------|-----------|
| Manager (Gerente) | Restaurant/store owner or manager | Mobile App (iOS/Android) |
| Employee (Funcionário) | Hourly worker | Mobile App (simplified) + WhatsApp |

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
- **Authentication:** Firebase Auth (@react-native-firebase/auth) for managers, OTP for employees
- **Animations:** react-native-reanimated
- **Haptics:** expo-haptics
- **Visual Effects:** expo-blur

### Backend (API)
- **Runtime:** Node.js + Express
- **Language:** TypeScript
- **Database:** Firebase Firestore
- **Authentication:** Firebase Admin SDK
- **Validation:** Zod schemas
- **WhatsApp:** WhatsApp Business Cloud API
- **AI:** Gemini 2.5 Flash (for NLP settings changes and schedule generation)

### Infrastructure
- **GCP Project:** `escala-simples-482616`
- **Auth:** Firebase Authentication (Email/Password for managers)
- **Database:** Firestore with composite indexes
- **Messaging:** WhatsApp Business API

---

## 3. Current Project Status (January 2026)

### What's Working

| Feature | Status | Notes |
|---------|--------|-------|
| Manager Authentication | ✅ Working | Email/password via Firebase |
| Employee Authentication | ✅ Working | OTP via WhatsApp verification |
| Establishment Onboarding | ✅ Working | 5-step flow complete |
| Team Management | ✅ Working | Add/edit/remove employees |
| Employee Home Screen | ✅ Working | Shows upcoming shifts |
| Settings (AI Chat) | ✅ Working | Gemini-powered settings changes |
| Basic Schedule View | ⚠️ Partial | Shows schedule but limited functionality |

### What's In Progress

**Intelligent Schedule System (See Plan Below)**
- Multiple shift definitions (morning/afternoon/night)
- 24/7 operation support
- Timeline visual view
- Conflict detection

### Recent Work Completed

1. **Access Control Separation** - Manager and employee views are now properly separated:
   - `app/(tabs)/` - Manager-only screens
   - `app/(employee)/` - Employee-only screens
   - `app/(auth)/login.tsx` - Manager login with link to employee login

2. **Employee Authentication Flow**:
   - OTP verification via WhatsApp
   - Session stored in AsyncStorage
   - Auto-routing based on auth state

3. **Firestore Indexes** - Deployed required composite indexes for queries

4. **React Version Resolution** - Fixed monorepo React version conflicts

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
│   ├── team.tsx             # Team management
│   ├── schedule.tsx         # Schedule view
│   └── settings.tsx         # AI chat settings
└── (employee)/              # Employee screens
    ├── _layout.tsx
    ├── login.tsx            # OTP login
    ├── home.tsx             # Employee dashboard
    └── availability.tsx     # Set availability
```

---

## 5. Key Architecture Decisions

### 1. Dual Authentication System
- **Managers:** Firebase Auth (email/password) - full access to establishment
- **Employees:** OTP verification - limited access to their own data

### 2. Apple Human Interface Guidelines (HIG)
All UI follows Apple HIG principles (see CLAUDE.md for details).

### 3. Gemini for NLP
Settings can be changed via natural language:
- User: "Abre às 10h na segunda"
- System interprets and proposes changes
- User confirms before applying

### 4. Brazilian Localization
- All user-facing text in Portuguese
- Phone mask: `(XX) XXXXX-XXXX`
- International format: `5511999999999`

---

## 6. Schedule System Plan (In Progress)

A comprehensive plan exists at `.claude/plans/generic-leaping-fiddle.md`. Key points:

### Problem
Current schedule generation is too basic - hardcoded 2 employees, single shift.

### Solution: Multiple Shift Definitions

```typescript
type ShiftDefinition = {
  id: string;
  type: 'morning' | 'afternoon' | 'night' | 'custom';
  label: string;           // "Turno Matutino"
  startTime: string;       // "06:00"
  endTime: string;         // "14:00"
  minEmployees: number;    // 2
};

// Example for 24/7 restaurant:
settings.shiftDefinitions = [
  { type: 'morning', label: 'Manhã', startTime: '06:00', endTime: '14:00', minEmployees: 2 },
  { type: 'afternoon', label: 'Tarde', startTime: '14:00', endTime: '22:00', minEmployees: 2 },
  { type: 'night', label: 'Noite', startTime: '22:00', endTime: '06:00', minEmployees: 1 },
];
```

### Implementation Phases

1. **Phase 1:** Add shiftDefinitions to settings, modify schedule generation
2. **Phase 2:** Employee availability/restrictions input
3. **Phase 3:** Conflict detection and resolution UI
4. **Phase 4:** Publish and notify via WhatsApp

### Files to Create/Modify

```
apps/mobile/src/components/schedule/
├── DayTimelineView.tsx        # Timeline visual
├── ShiftBlock.tsx             # Individual shift block
└── ShiftListItem.tsx          # List item

apps/mobile/app/(tabs)/schedule.tsx  # Main schedule screen
apps/api/src/types/index.ts          # ShiftDefinition type
```

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

# Check Expo bundler
curl http://localhost:8081/status

# Kill all node processes if needed (careful!)
pkill -f "node.*escala-simples"
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
      shiftDefinitions?: ShiftDefinition[]  # NEW - for multi-shift support
    }
    status: 'pending' | 'active'
    onboardingStep: number | null
    createdAt, updatedAt: Timestamp

employees/
  {employeeId}/
    establishmentId: string
    name: string
    phone: string (formatted: 5511999999999)
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
    # NEW - for employee availability system
    recurringAvailability?: {
      [dayOfWeek: number]: {
        available: boolean
        startTime?: string
        endTime?: string
        blockedShiftTypes?: string[]
      }
    }
    temporaryAvailability?: Array<{
      id: string
      startDate: string
      endDate: string
      type: 'unavailable' | 'partial'
      reason?: string
    }>
    createdAt, updatedAt: Timestamp

invites/
  {inviteToken}/
    employeeId, establishmentId, token: string
    createdAt, expiresAt: Timestamp
    used: boolean
    usedAt?: Timestamp

schedules/  # To be implemented
  {scheduleId}/
    establishmentId: string
    weekStart: string (YYYY-MM-DD)
    status: 'draft' | 'published'
    shifts: Shift[]
    conflicts: Conflict[]
    createdAt, publishedAt: Timestamp
```

### Required Indexes (firestore.indexes.json)

Key indexes already deployed:
- `establishments`: ownerId + createdAt (DESC)
- `employees`: establishmentId + createdAt (DESC)
- `employees`: establishmentId + status + name
- `invites`: establishmentId + createdAt (DESC)

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
- `POST /` - Add employee
- `POST /batch` - Add multiple employees
- `PUT /:id` - Update employee
- `DELETE /:id` - Remove employee

### Invites (`/invites`)
- `POST /send` - Send WhatsApp invite
- `POST /send-bulk` - Bulk send invites
- `POST /resend/:id` - Resend invite
- `GET /validate/:token` - Validate token (public)
- `POST /submit-restrictions` - Submit restrictions (public)

### Employee Auth (`/employee`)
- `POST /auth/request-otp` - Request OTP via WhatsApp
- `POST /auth/verify-otp` - Verify OTP and get session

---

## 10. Important Files Reference

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project guidelines, design system, API docs |
| `handover.md` | This file - AI agent onboarding |
| `.claude/plans/generic-leaping-fiddle.md` | Schedule system implementation plan |
| `firestore.indexes.json` | Firestore composite indexes |
| `apps/api/src/index.ts` | Express server entry point |
| `apps/api/src/services/gemini.ts` | Gemini AI service |
| `apps/api/src/services/whatsapp.ts` | WhatsApp messaging |
| `apps/mobile/src/services/api.ts` | API client |
| `apps/mobile/src/hooks/useEstablishment.tsx` | Establishment state |
| `apps/mobile/src/hooks/useEmployeeAuth.tsx` | Employee auth hook |

---

## 11. Next Steps for New Agent

### Immediate Priority: Schedule System

1. **Read the plan:** `.claude/plans/generic-leaping-fiddle.md`

2. **Implement Phase 1:**
   - Add `ShiftDefinition` type to `apps/api/src/types/index.ts`
   - Add default shiftDefinitions to establishment settings
   - Update schedule generation logic in `apps/mobile/app/(tabs)/schedule.tsx`
   - Create `DayTimelineView.tsx` component

3. **Test locally:**
   - Start API and Expo
   - Verify schedule shows multiple shifts
   - Verify timeline renders correctly

### Secondary: Employee Availability

- Implement availability input UI in `(employee)/availability.tsx`
- Save recurring and temporary availability
- Integrate with schedule generation

### Future Work

- Conflict detection and resolution
- Schedule publishing with WhatsApp notifications
- Shift swap requests

---

## 12. Key Reminders

- **All UI:** Follow Apple HIG (see CLAUDE.md)
- **User messages:** Always in Portuguese
- **Code:** Always in English
- **AI model:** Use Gemini 2.5 Flash exclusively (no Claude/GPT in backend)
- **Package manager:** npm only (not yarn or pnpm)
- **Verification:** Always test changes locally before marking complete
- **TypeScript:** Run `npx tsc --noEmit` before committing

---

## 13. Questions? Check:

1. `CLAUDE.md` - Design guidelines, code patterns, common mistakes
2. `.taskmaster/docs/prd.txt` - Product requirements
3. `.claude/plans/` - Implementation plans
4. This file - Project status and architecture

---

*Handover document maintained for continuity between AI coding agents.*
