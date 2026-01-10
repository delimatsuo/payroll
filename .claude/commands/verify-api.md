# Verify API Changes

Run all verification steps for API changes.

## Context

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -50
```

## Instructions

1. First check the TypeScript output above for any errors
2. If there are errors, fix them before proceeding
3. If no errors, verify the API works correctly:
   - Start the server with `npm run dev`
   - Test the modified endpoints with curl
   - Check Firestore for correct data persistence
   - Verify error responses are in Portuguese

## Test Commands

```bash
# Example: Test GET endpoint
curl -X GET http://localhost:3001/establishment \
  -H "Authorization: Bearer YOUR_TOKEN"

# Example: Test POST endpoint
curl -X POST http://localhost:3001/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "Test", "phone": "11999999999"}'
```

## Checklist

- [ ] TypeScript compiles without errors
- [ ] Server starts without crashes
- [ ] Endpoints return correct data
- [ ] Error messages are in Portuguese
- [ ] Authentication middleware works
- [ ] Zod validation catches invalid input
- [ ] Firestore data is persisted correctly
