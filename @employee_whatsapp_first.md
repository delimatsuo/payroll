# Ralph Plan: WhatsApp-First Employee Experience

> **Goal**: Remove native employee app, implement WhatsApp-first experience with web fallbacks.
> **Completion Promise**: Output `<promise>WHATSAPP FIRST COMPLETE</promise>` when ALL tasks are done.

---

## Phase 1: Remove Native Employee App ✅
- [x] Delete `apps/mobile/app/(employee)/` folder entirely
- [x] Remove employee-related routes from mobile app navigation
- [x] Remove employee auth hooks/services that are no longer needed
- [x] Update `apps/mobile/app/index.tsx` to remove employee routing logic
- [x] Update `apps/mobile/app/(auth)/role-select.tsx` - removed entirely (no longer needed)
- [x] Clean up any orphaned imports/types
- [x] Run TypeScript check - must pass with no errors

## Phase 2: Create Web App for Employee Views ✅
- [x] Create `apps/web/` folder structure (simple static HTML + vanilla JS)
- [x] Create employee schedule view page (`/schedule/:token`)
  - Shows week view of employee's shifts
  - Mobile-optimized responsive design
  - No login required - token-based access
- [x] Create availability form page (`/availability/:token`)
  - Simple form to set recurring availability per day
  - Submit saves to API
- [x] Create swap confirmation page (`/swap/:token`)
  - Shows swap request details
  - Accept/Decline buttons
- [x] Routes added in Phase 4

## Phase 3: Enhance WhatsApp Integration ✅
- [x] Update invite flow to include web link for availability setup
  - `sendEmployeeInvite()` now generates short token and includes availability web link
- [x] Create schedule notification message format
  - `sendScheduleNotification()` now includes web calendar link
  - Include shifts for the week
  - Include link to full web calendar view
- [x] Implement inbound message parsing for:
  - "qual minha escala" → respond with schedule (`parseEmployeeMessage()`)
  - "não posso [dia]" → parse restriction, confirm
  - "trocar [dia]" → initiate swap flow
- [x] Add helper functions:
  - `sendSwapRequest()` - notify employee of swap request with web link
  - `sendHelpMessage()` - show available commands
  - `sendScheduleReply()` - respond to schedule query
  - `sendRestrictionConfirmation()` - confirm restriction was saved

## Phase 4: Update Employee API Endpoints ✅
- [x] Create GET `/employee/schedule/:token` - public, token-validated
- [x] Create GET `/employee/availability/:token` - get current availability
- [x] Create POST `/employee/availability/:token` - set availability (no auth, token-based)
- [x] Create GET `/swap/:token` - get swap request details
- [x] Create POST `/swap/:token/respond` - accept/decline swap
- [x] Generate secure, time-limited tokens for each employee action
- [x] Created `employeeToken.ts` service for token generation/validation
- [x] Added `employeeTokens` collection to Firestore

## Phase 5: Cleanup & Verification ✅
- [x] Reviewed employee auth endpoints - kept for OTP verification (still useful)
- [x] TypeScript check passes for mobile app
- [x] TypeScript check passes for API (excluding pre-existing test-chat.ts issues)
- [x] Updated invites.ts route to use new `sendEmployeeInvite()` signature
- [x] Updated schedules.ts to use new `sendScheduleNotification()` signature

---

## Files Created/Modified

### New Files
- `apps/web/public/index.html` - Landing page
- `apps/web/public/schedule.html` - Schedule view
- `apps/web/public/availability.html` - Availability form
- `apps/web/public/swap.html` - Swap confirmation
- `apps/web/public/styles.css` - Shared styles
- `apps/web/package.json` - Web app config
- `apps/api/src/services/employeeToken.ts` - Token service
- `apps/api/src/routes/employeePublic.ts` - Public employee routes

### Modified Files
- `apps/api/src/services/whatsapp.ts` - Enhanced with web links
- `apps/api/src/services/firebase.ts` - Added employeeTokens collection
- `apps/api/src/routes/invites.ts` - Updated to use new signature
- `apps/api/src/routes/schedules.ts` - Updated to use new signature
- `apps/api/src/index.ts` - Registered new routes
- `apps/mobile/app/index.tsx` - Removed employee routing
- `apps/mobile/app/_layout.tsx` - Removed employee screens
- `apps/mobile/app/(auth)/login.tsx` - Removed role switch link

### Deleted Files
- `apps/mobile/app/(employee)/` - Entire folder
- `apps/mobile/app/(auth)/role-select.tsx`

---

## Technical Notes

### Token Strategy
- HMAC-signed tokens with base64url encoding
- Token format: `<payload>.<signature>`
- Token encodes: employeeId, establishmentId, action, expiresAt, swapId (optional)
- Short codes stored in Firestore for user-friendly URLs
- Expiry times:
  - Schedule: 7 days
  - Availability: 72 hours
  - Swap: 2 hours

### Web App Stack
- Static HTML + vanilla JS (fastest to build)
- Mobile-first responsive design
- API calls to token-validated endpoints
- No build step required

### WhatsApp Message Templates (Need Meta Approval)
1. `employee_schedule` - Weekly schedule notification
2. `availability_reminder` - Ask employee to set availability
3. `swap_request` - Someone wants to swap with you
4. `swap_confirmed` - Swap was approved

---

## Success Criteria ✅
- [x] No employee screens in mobile app
- [x] Employee can view schedule via web link from WhatsApp
- [x] Employee can set availability via web form
- [x] Employee can respond to swap via web page
- [x] All interactions initiated via WhatsApp messages

---

*Created: January 2026*
*Completed: January 2026*
*Method: Ralph Wiggum iterative development*
