/**
 * Test script for Chat API endpoints
 * Run with: npx tsx src/scripts/test-chat.ts
 */

import { auth } from '../services/firebase';

const API_BASE = 'http://localhost:3001';

async function getTestToken(): Promise<string> {
  // Create a test user UID
  const testUid = 'test-user-' + Date.now();

  // Create a custom token
  const customToken = await auth.createCustomToken(testUid);

  // Exchange custom token for ID token using Firebase REST API
  const apiKey = process.env.FIREBASE_API_KEY || 'AIzaSyCeuIhzp9Pwo26N3iTf6DcuEJvW5Jdz4_k';

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get ID token: ${error}`);
  }

  const data = await response.json();
  return data.idToken;
}

async function testChatFlow() {
  console.log('🧪 Testing Chat API Flow\n');

  try {
    // Get auth token
    console.log('1️⃣  Getting test authentication token...');
    const token = await getTestToken();
    console.log('   ✅ Got token:', token.substring(0, 50) + '...\n');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    // Test /chat/start
    console.log('2️⃣  Starting chat session...');
    const startRes = await fetch(`${API_BASE}/chat/start`, {
      method: 'POST',
      headers,
    });
    const startData = await startRes.json();
    console.log('   Status:', startRes.status);
    console.log('   Response:', JSON.stringify(startData, null, 2).substring(0, 500));

    if (!startRes.ok) {
      console.log('   ❌ Failed to start chat\n');
      return;
    }

    const sessionId = startData.sessionId;
    console.log('   ✅ Session ID:', sessionId);
    console.log('   Initial messages:', startData.messages?.length || 0, '\n');

    // Test /chat/message - send business name
    console.log('3️⃣  Sending business name...');
    const msgRes = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId,
        content: 'Restaurante do João',
      }),
    });
    const msgData = await msgRes.json();
    console.log('   Status:', msgRes.status);
    console.log('   New messages:', msgData.messages?.length || 0);
    console.log('   State:', msgData.state);
    if (msgData.messages?.[0]) {
      console.log('   First message:', msgData.messages[0].content?.substring(0, 100));
    }
    console.log('');

    // Test /chat/action - select business type
    console.log('4️⃣  Selecting business type (restaurant)...');
    const actionRes = await fetch(`${API_BASE}/chat/action`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId,
        action: 'restaurant',
      }),
    });
    const actionData = await actionRes.json();
    console.log('   Status:', actionRes.status);
    console.log('   State:', actionData.state);
    console.log('   New messages:', actionData.messages?.length || 0);
    if (actionData.messages?.[0]) {
      console.log('   First message:', actionData.messages[0].content?.substring(0, 100));
    }
    console.log('');

    // Test /chat/session/:id
    console.log('5️⃣  Fetching session state...');
    const sessionRes = await fetch(`${API_BASE}/chat/session/${sessionId}`, {
      method: 'GET',
      headers,
    });
    const sessionData = await sessionRes.json();
    console.log('   Status:', sessionRes.status);
    console.log('   State:', sessionData.state);
    console.log('   Total messages:', sessionData.messages?.length || 0);
    console.log('   Data collected:', JSON.stringify(sessionData.data || {}, null, 2).substring(0, 300));
    console.log('');

    console.log('✅ All tests completed successfully!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  process.exit(0);
}

testChatFlow();
