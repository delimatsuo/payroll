# Escala Simples - AI Agent Handover Document

**Last Updated:** January 14, 2026
**Project:** Escala Simples - Scheduling System for Brazilian Restaurants & Retail
**Status:** In Development (MVP Phase)
**Framework:** Ralph Autonomous Development
**Current Sprint:** UX Improvements (Apple HIG Compliance) - ✅ COMPLETED

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
| Employee (Funcionário) | Hourly worker | **WhatsApp + Web** (no native app) |

### Core Value Proposition

```
MANAGER: "Configure once, approve when needed." (Mobile App)
EMPLOYEE: "Tell us when you can't work, swap with colleagues." (WhatsApp)
```

---

## 2. Architecture (WhatsApp-First for Employees)

### Why WhatsApp-First?

- **Zero friction:** 99% of Brazilians have WhatsApp
- **No app download:** Employees don't need to install anything
- **Natural interaction:** Simple text commands like "qual minha escala"
- **Web fallback:** Token-based web pages for complex interactions

### System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Manager App   │────▶│    API Server   │◀────│    WhatsApp     │
│  (React Native) │     │   (Express.js)  │     │  Business API   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │                       ▲
                                 │                       │
                                 ▼                       │
                        ┌─────────────────┐     ┌───────┴───────┐
                        │    Firestore    │     │   Employee    │
                        │    Database     │     │  (WhatsApp)   │
                        └─────────────────┘     └───────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    Web Pages    │ (schedule, availability, swap)
                        │   (Static HTML) │
                        └─────────────────┘
```

---

## 3. Tech Stack

### Frontend (Manager Mobile App)
- **Framework:** React Native + Expo (SDK 52)
- **Navigation:** expo-router (file-based routing)
- **Language:** TypeScript
- **Authentication:** Firebase Auth (email/password)
- **Animations:** react-native-reanimated
- **Haptics:** expo-haptics

### Frontend (Employee Web Pages)
- **Stack:** Static HTML + Vanilla JavaScript
- **Pages:** schedule.html, availability.html, swap.html
- **Auth:** Token-based (no login required)
- **Location:** `apps/web/public/`

### Backend (API)
- **Runtime:** Node.js + Express
- **Language:** TypeScript
- **Database:** Firebase Firestore
- **Authentication:** Firebase Admin SDK
- **Validation:** Zod schemas
- **AI:** Gemini 2.5 Flash

### Infrastructure
- **GCP Project:** `escala-simples-482616`
- **Auth:** Firebase Authentication
- **Database:** Firestore with composite indexes
- **Build System:** EAS Build (Expo Application Services)

---

## 4. Current Project Status (January 14, 2026)

### What's Working

| Feature | Status | Notes |
|---------|--------|-------|
| Manager Authentication | ✅ Working | Email/password via Firebase |
| Establishment Onboarding | ✅ Working | 2-step flow (Team → Complete) |
| Team Management | ✅ Working | Add/edit/remove employees |
| Employee Invitations | ✅ Working | WhatsApp with availability link |
| AI Schedule Generation | ✅ Working | Gemini-powered with CLT validation |
| Schedule Publishing | ✅ Working | WhatsApp notifications with web link |
| **Employee Web Pages** | ✅ NEW | schedule.html, availability.html, swap.html |
| **Token Service** | ✅ NEW | Secure short-code tokens for web access |
| **WhatsApp Integration** | ✅ Enhanced | Inbound message parsing, web links |

### Recent Work Completed (January 14, 2026)

#### WhatsApp-First Employee Experience Implementation

**Phase 1: Remove Native Employee App ✅**
- Deleted `apps/mobile/app/(employee)/` folder entirely
- Removed `apps/mobile/app/(auth)/role-select.tsx`
- Updated routing to be manager-only

**Phase 2: Create Web App for Employees ✅**
- Created `apps/web/public/` folder
- `schedule.html` - View weekly schedule
- `availability.html` - Set recurring availability
- `swap.html` - Accept/decline swap requests
- `styles.css` - Mobile-optimized responsive design

**Phase 3: Enhance WhatsApp Integration ✅**
- Updated `sendEmployeeInvite()` with availability web link
- Updated `sendScheduleNotification()` with schedule web link
- Added `parseEmployeeMessage()` for inbound message parsing
- Added `sendSwapRequest()`, `sendHelpMessage()`, `sendScheduleReply()`

**Phase 4: Employee Token Service ✅**
- Created `apps/api/src/services/employeeToken.ts`
- HMAC-signed tokens with base64url encoding
- Short codes stored in Firestore for user-friendly URLs
- Expiry: Schedule (7d), Availability (72h), Swap (2h)

**Phase 5: Public API Routes ✅**
- Created `apps/api/src/routes/employeePublic.ts`
- `GET /employee/schedule/:token`
- `GET /employee/availability/:token`
- `POST /employee/availability/:token`
- `GET /swap/:token`
- `POST /swap/:token/respond`

---

## 5. Route Structure

### Mobile App (Manager Only)

```
apps/mobile/app/
├── _layout.tsx              # Root layout
├── index.tsx                # Splash → routes to login or tabs
├── (auth)/                  # Manager authentication
│   ├── _layout.tsx
│   ├── login.tsx            # Email/password login
│   ├── signup.tsx           # Combined: Auth + Business Name/Type
│   └── forgot-password.tsx
├── (onboarding)/            # Manager onboarding (2 steps)
│   ├── _layout.tsx
│   ├── team.tsx             # Step 1: Add employees
│   └── complete.tsx         # Step 2: Review & Activate
└── (tabs)/                  # Manager main app
    ├── _layout.tsx
    ├── index.tsx            # Dashboard
    ├── team.tsx             # Team management
    ├── schedule.tsx         # Schedule view
    └── settings.tsx         # AI chat settings
```

### Web App (Employee)

```
apps/web/public/
├── index.html               # Landing page
├── schedule.html            # View weekly schedule
├── availability.html        # Set recurring availability
├── swap.html                # Accept/decline swap
└── styles.css               # Shared mobile-optimized styles
```

### API Routes

```
/establishment/*             # Manager establishment routes
/employees/*                 # Manager employee management
/schedules/*                 # Manager schedule routes
/invites/*                   # Invite management

# Public (token-validated, no auth)
/employee/schedule/:token    # GET employee schedule
/employee/availability/:token # GET/POST availability
/swap/:token                 # GET swap details
/swap/:token/respond         # POST accept/decline
```

---

## 6. Employee Interaction Flow

### Invite Flow
1. Manager adds employee in mobile app
2. Manager sends WhatsApp invite
3. Employee receives message with availability link
4. Employee sets availability via web form
5. Employee is ready for scheduling

### Schedule Notification Flow
1. Manager generates and publishes schedule
2. API sends WhatsApp to each employee
3. Message includes shifts + web calendar link
4. Employee can query "minha escala" for current schedule

### Swap Flow
1. Employee texts "trocar segunda"
2. System finds available colleagues
3. Swap request sent via WhatsApp with web link
4. Target employee accepts/declines via web page
5. Schedule automatically updated

### WhatsApp Commands
- `"minha escala"` or `"qual minha escala"` → Returns schedule
- `"não posso [dia]"` → Records restriction
- `"trocar [dia]"` → Initiates swap request
- `"ajuda"` or `"?"` → Shows available commands

---

## 7. Development Setup

### Running Locally

```bash
# Terminal 1: Start API
cd apps/api && npm run dev

# Terminal 2: Start Mobile (Web)
cd apps/mobile && npx expo start --web

# Terminal 3: Serve Employee Web Pages (optional)
cd apps/web && npx serve public
```

### iOS Simulator (EAS Build)

```bash
cd apps/mobile
eas build --profile development --platform ios
eas build:run --platform ios --latest
npx expo start --dev-client
```

### TypeScript Verification

```bash
# Mobile app
cd apps/mobile && npx tsc --noEmit

# API
cd apps/api && npx tsc --noEmit
```

---

## 8. Key Files Reference

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project guidelines, design system |
| `@fix_plan.md` | Task checklist with current sprint |
| `@employee_whatsapp_first.md` | WhatsApp-first implementation plan |
| `handover.md` | This file |
| `apps/api/src/services/employeeToken.ts` | Token generation/validation |
| `apps/api/src/routes/employeePublic.ts` | Public employee endpoints |
| `apps/api/src/services/whatsapp.ts` | WhatsApp messaging service |
| `apps/web/public/*.html` | Employee web pages |

---

## 9. Firestore Collections

```
establishments/
  {establishmentId}/
    name, type, ownerId, operatingHours, settings, status, onboardingStep

employees/
  {employeeId}/
    establishmentId, name, phone, status, inviteStatus
    recurringAvailability, temporaryAvailability, availabilityNotes

employeeTokens/
  {shortCode}/
    fullToken, employeeId, establishmentId, action, swapId
    createdAt, expiresAt, used, usedAt

schedules/
  {scheduleId}/
    establishmentId, weekStartDate, weekEndDate, status, shifts
    createdAt, updatedAt, publishedAt

swapRequests/
  {swapId}/
    requesterId, targetId, scheduleId, shiftId, shiftDate
    status, message, expiresAt, respondedAt
```

---

## 10. Next Steps

### High Priority
- [ ] WhatsApp webhook for inbound messages (`POST /webhooks/whatsapp`)
- [ ] Implement restriction collection via WhatsApp
- [ ] Complete swap flow with notifications

### Medium Priority
- [ ] Manager dashboard improvements
- [ ] Emergency coverage flow
- [ ] Schedule conflict resolution UI

### Low Priority
- [ ] Performance optimization
- [ ] Error tracking (Sentry)
- [ ] Unit tests for schedule generation

---

## 11. Key Reminders

- **Manager UI:** Mobile app (React Native + Expo)
- **Employee UI:** WhatsApp + Web pages (no native app)
- **All user messages:** Portuguese
- **All code:** English
- **AI model:** Gemini 2.5 Flash only
- **Package manager:** npm only
- **iOS builds:** Use EAS Build
- **TypeScript:** Run `npx tsc --noEmit` before committing

---

*Handover document maintained for continuity between AI coding agents.*
*Last agent session: January 14, 2026 - WhatsApp-first employee experience implementation*
