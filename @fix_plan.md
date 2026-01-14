# Ralph Fix Plan - Escala Simples

> **Note**: This is the prioritized task list for Ralph autonomous development.
> Tasks marked [x] are complete, [ ] are pending, [/] are in progress.

---

## 🔥 CURRENT SPRINT: UX Improvements (Apple HIG Compliance)

> **Goal**: Improve authentication and onboarding flows following Apple Human Interface Guidelines.
> **Priority**: HIGH - These are blocking user testing.

### Phase 1: App Architecture (Manager-Only Mobile)
- [x] Mobile app is now manager-only (WhatsApp-first for employees)
- [x] Removed role selection screen (no longer needed)
- [x] Removed `apps/mobile/app/(employee)/` folder entirely
- [x] Removed `apps/mobile/app/(auth)/role-select.tsx`
- [x] Updated `apps/mobile/app/index.tsx` to route directly to login
- [x] Removed "Sou funcionário" link from login screen

### Phase 2: Onboarding Simplification (5 → 2 steps)
- [x] Merge signup fields with onboarding step 1
  - New signup collects: Email, Password, Business Name, Business Type
  - Remove separate "name" field (use business name for display)
  - Location: `apps/mobile/app/(auth)/signup.tsx`
- [x] Remove onboarding/name.tsx (merged into signup)
- [x] Update onboarding flow:
  - Step 1: Team Setup (was step 4) - ESSENTIAL
  - Step 2: Review & Activate (was step 5) - simplified
- [x] Defer to Settings (remove from onboarding):
  - Operating hours → Settings tab
  - Swap rules → Settings tab
  - Min employees → Settings tab
- [x] Update progress indicator to show 2 steps instead of 5
- [x] Remove conversational onboarding (chat.tsx) - keep only CRUD flow

### Phase 3: Employee Experience (Updated to WhatsApp-First)
- [x] Removed native employee app - employees now use WhatsApp exclusively
- [x] Created web fallback pages for schedule/availability/swap
- [x] Token-based access (no login required)
- [x] Web pages: schedule.html, availability.html, swap.html
- [x] Employee token service with short codes for WhatsApp links

### Phase 4: Polish
- [x] Fix iOS password autofill overlay (textContentType="oneTimeCode")
- [x] Fix GO_BACK navigation error (remove replace from Link)
- [x] Add haptic feedback to role selection buttons
- [x] Add smooth transitions between auth screens

### Verification
- [x] TypeScript check passes for mobile app
- [x] TypeScript check passes for API
- [x] Test complete manager flow: Login → Signup → Team → Complete → Tabs
- [x] Employee experience is now WhatsApp-first (web fallback via token links)
- [x] Test back navigation works on all screens
- [x] Mobile app no longer has employee screens (removed per WhatsApp-first architecture)

---

## ✅ Completed (Already Implemented)

### Project Setup
- [x] Create monorepo structure (apps/mobile, apps/api)
- [x] Initialize React Native + Expo project
- [x] Initialize Express.js API
- [x] Configure TypeScript strict mode
- [x] Set up ESLint and Prettier
- [x] Firestore indexes deployed
- [x] Firestore security rules configured

### Authentication
- [x] Firebase Auth integration (email/password for managers)
- [x] Manager login/signup screens
- [x] Forgot password flow
- [x] Employee OTP authentication via WhatsApp
- [x] JWT token handling
- [x] Auth state persistence

### Manager Onboarding (5-step flow)
- [x] Onboarding/Name screen (establishment name + type)
- [x] Onboarding/Hours screen (operating hours per day)
- [x] Onboarding/Settings screen (min employees + swap rules)
- [x] Onboarding/Team screen (add employees)
- [x] Onboarding/Complete screen
- [x] Onboarding state persistence

### Team Management
- [x] GET /employees - List employees
- [x] POST /employees - Add single employee
- [x] POST /employees/batch - Add multiple employees
- [x] PUT /employees/:id - Update employee
- [x] DELETE /employees/:id - Remove employee
- [x] Team management screen in mobile app

### WhatsApp Invites (Partial)
- [x] POST /invites/send - Send WhatsApp invite
- [x] POST /invites/send-bulk - Bulk send invites
- [x] POST /invites/resend/:id - Resend invite
- [x] GET /invites/validate/:token - Validate token (public)

### AI Settings Chat
- [x] Gemini service for settings interpretation
- [x] POST /establishment/chat - AI settings changes
- [x] POST /establishment/chat/apply - Apply suggestions
- [x] Settings tab with AI chat interface

### Employee App
- [x] Employee login (OTP)
- [x] Employee home screen
- [x] Employee sees upcoming shifts

---

## 🔴 High Priority (Core Missing Features)

### WhatsApp Restriction Collection (US-008 to US-011)
- [ ] Extend Gemini service for restriction parsing
  - Input: "Quarta não posso", "Terça e quinta depois das 18h"
  - Output: `Restriction[]` with dayOfWeek, type, startTime, endTime
- [ ] Create POST /webhooks/whatsapp endpoint for inbound messages
- [ ] Implement restriction confirmation WhatsApp flow
  - Bot parses restriction → confirms with employee → saves
- [ ] POST /invites/submit-restrictions endpoint
- [ ] Build Restrictions approval screen for manager
- [ ] PATCH /employees/:id/restrictions/:restrictionId endpoint

### Schedule Generation (US-012 to US-015)
- [ ] Create Schedule and Shift interfaces in types
- [ ] Implement schedule generation algorithm
  - List operating days
  - Calculate available employees per day
  - Distribute shifts fairly (score-based)
  - Validate CLT rules (weekly rest, max consecutive days)
- [ ] POST /establishments/:id/schedules endpoint
- [ ] POST /schedules/:id/generate endpoint
- [ ] Build Schedule grid component (DayColumn, ShiftCell)
- [ ] Build manual schedule editing UI
- [ ] PATCH /schedules/:id/shifts endpoint
- [ ] Implement conflict resolution UI
- [ ] POST /schedules/:id/publish endpoint
- [ ] WhatsApp notification on schedule publish

---

## 🟡 Medium Priority (Workflow Features)

### Swap Flow (US-016 to US-019)
- [ ] Implement swap request WhatsApp flow
  - Employee says "não posso sexta" → System offers options
- [ ] Create SwapRequest model and Firestore collection
- [ ] Implement cover acceptance WhatsApp flow
- [ ] Build swap approval screen for manager
- [ ] GET /establishments/:id/swap-requests endpoint
- [ ] PATCH /swap-requests/:id endpoint
- [ ] Implement automatic schedule update after approval
- [ ] Track monthly swap limits per employee
- [ ] Implement change notifications

### Emergency Coverage (US-020 to US-021)
- [ ] Build Emergency absence screen ("Alguém Faltou" button)
- [ ] Implement coverage suggestion algorithm
  - Who's off today
  - Who can do overtime
- [ ] POST /schedules/:id/emergency endpoint
- [ ] POST /schedules/:id/emergency/request-cover endpoint
- [ ] Urgent coverage WhatsApp message (🆘 emoji)

---

## 🟢 Medium Priority (UI & Navigation)

### Manager Home Dashboard (US-022)
- [ ] Build home dashboard showing:
  - Today's date and who's working
  - "Alguém Faltou" button
  - Pending items (swaps, restrictions)
  - Week calendar preview
- [ ] Bottom navigation: Home, Schedule, Team, Settings

### Schedule Visualization (US-023)
- [ ] Weekly schedule grid view
- [ ] Day column with employee shifts
- [ ] Navigate between weeks
- [ ] Visual indicators (working/off)
- [ ] Tap to edit (if draft)

### Employee Schedule Query (US-024)
- [ ] Handle "qual minha escala" WhatsApp message
- [ ] Respond with formatted schedule
- [ ] Include link to web view (future)

---

## 🔵 Low Priority (Polish & Optimization)

### Performance
- [ ] Implement list pagination (20 items)
- [ ] Add data caching
- [ ] Implement lazy loading for screens
- [ ] Optimize schedule generation (< 5s target)

### Error Handling
- [ ] Implement global error boundary
- [ ] Add retry logic for failed WhatsApp messages
- [ ] Create user-friendly error messages (Portuguese)
- [ ] Add error tracking (Sentry or similar)

### Testing
- [ ] Set up Jest for unit tests
- [ ] Write tests for schedule generation algorithm
- [ ] Write tests for restriction parsing
- [ ] Write tests for swap workflow

### Documentation
- [ ] API documentation
- [ ] WhatsApp conversation flow diagrams
- [ ] Deployment guide

---

## Notes

### Business Rules to Remember
- Minimum 1 weekly rest day per employee (CLT requirement)
- Maximum 6 consecutive work days
- 11 hours minimum between shifts (CLT)
- Phone numbers always in E.164 format (+5511999999999)
- Dates in ISO 8601 (YYYY-MM-DD), times in 24h format (HH:mm)
- Restriction response deadline: 72 hours (configurable)
- Swap response timeout: 2 hours for normal, 30 minutes for emergency

### WhatsApp Templates Required (Need Meta Approval)
1. Employee invite ✅ (implemented)
2. Restriction reminder
3. Schedule published
4. Swap request
5. Swap accepted/rejected
6. Emergency coverage request
7. Schedule updated

### Key Metrics to Track
- Onboarding completion rate (target: > 70%)
- Employee restriction response rate (target: > 70%)
- Schedule generation time (target: < 5s)
- Swap auto-resolution rate (target: > 80%)
- D7 retention (target: > 60%)

---

*Updated: January 2026*
*Based on PRD v2.0 analysis*
