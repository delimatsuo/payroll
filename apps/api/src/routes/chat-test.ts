/**
 * Chat Test Routes - Development Only
 *
 * These routes bypass Firebase authentication for testing purposes.
 * ONLY available when NODE_ENV === 'development'
 *
 * POST /test/chat/start    - Start a new onboarding session
 * POST /test/chat/message  - Send a user message
 * GET  /test/chat/session/:id - Get session state
 * POST /test/chat/action   - Handle button/component actions
 */

import { Router, Request, Response } from 'express';
import { collections } from '../services/firebase';
import {
  createSession,
  processMessage,
  processAction,
  isComplete,
} from '../services/chatStateMachine';
import {
  OnboardingSession,
  ChatResponse,
} from '../types/chat';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

// Mock user for testing
const MOCK_USER = {
  uid: 'test-user-dev-001',
  email: 'test@example.com',
};

// Firestore collection for chat sessions
const sessionsCollection = () => collections.establishments.firestore.collection('onboarding_sessions');

/**
 * POST /test/chat/start
 * Start a new onboarding chat session (no auth required)
 *
 * For testing, always creates a fresh session (use /reset first for clean state)
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    console.log('🧪 [TEST] Starting chat session for mock user:', MOCK_USER.uid);

    // For testing, check if there's an existing incomplete session
    // Simple query without ordering to avoid index requirement
    const existingSnapshot = await sessionsCollection()
      .where('userId', '==', MOCK_USER.uid)
      .get();

    // Find an incomplete session manually
    const incompleteSessions = existingSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() as OnboardingSession }))
      .filter(s => s.state !== 'complete');

    if (incompleteSessions.length > 0) {
      const session = incompleteSessions[0];
      console.log('🧪 [TEST] Resuming existing session:', session.id);
      res.json({
        sessionId: session.id,
        messages: session.messages,
        state: session.state,
        data: session.data,
      });
      return;
    }

    // Create new session
    const session = await createSession(MOCK_USER.uid);

    // Save to Firestore
    await sessionsCollection().doc(session.id).set({
      ...session,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log('🧪 [TEST] Created new session:', session.id);

    res.status(201).json({
      sessionId: session.id,
      messages: session.messages,
      state: session.state,
    });
  } catch (error) {
    console.error('🧪 [TEST] Error starting chat session:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao iniciar conversa',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /test/chat/message
 * Send a user message and get agent response (no auth required)
 */
router.post('/message', async (req: Request, res: Response) => {
  try {
    const { sessionId, content } = req.body;

    console.log('🧪 [TEST] Processing message for session:', sessionId);
    console.log('🧪 [TEST] Content:', content);

    if (!sessionId || typeof content !== 'string') {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'ID da sessão e conteúdo são obrigatórios',
      });
      return;
    }

    // Get session
    const sessionDoc = await sessionsCollection().doc(sessionId).get();

    if (!sessionDoc.exists) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Sessão não encontrada',
      });
      return;
    }

    const sessionData = sessionDoc.data() as OnboardingSession;

    // Check if already complete
    if (sessionData.state === 'complete') {
      res.status(400).json({
        error: 'Sessão finalizada',
        message: 'Esta sessão de onboarding já foi concluída',
      });
      return;
    }

    // Process message (async - may use AI for extraction)
    const { session, newMessages } = await processMessage(sessionData, content);

    // Check if onboarding is complete and create establishment
    let establishmentId: string | undefined;

    if (isComplete(session)) {
      establishmentId = await createEstablishmentFromSession(session, MOCK_USER.uid);
      console.log('🧪 [TEST] Created establishment:', establishmentId);
    }

    // Update session in Firestore
    await sessionsCollection().doc(sessionId).update({
      state: session.state,
      messages: session.messages,
      data: session.data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const response: ChatResponse = {
      messages: newMessages,
      state: session.state,
      isComplete: isComplete(session),
      establishmentId,
    };

    console.log('🧪 [TEST] Response state:', session.state, 'New messages:', newMessages.length);

    res.json(response);
  } catch (error) {
    console.error('🧪 [TEST] Error processing message:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao processar mensagem',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /test/chat/session/:id
 * Get session state for reconnection (no auth required)
 */
router.get('/session/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    console.log('🧪 [TEST] Fetching session:', id);

    const sessionDoc = await sessionsCollection().doc(id).get();

    if (!sessionDoc.exists) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Sessão não encontrada',
      });
      return;
    }

    const sessionData = sessionDoc.data() as OnboardingSession;

    res.json({
      sessionId: sessionDoc.id,
      messages: sessionData.messages,
      state: sessionData.state,
      data: sessionData.data,
      isComplete: sessionData.state === 'complete',
    });
  } catch (error) {
    console.error('🧪 [TEST] Error getting session:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar sessão',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /test/chat/action
 * Handle button clicks and component interactions (no auth required)
 */
router.post('/action', async (req: Request, res: Response) => {
  try {
    const { sessionId, action, data } = req.body;

    console.log('🧪 [TEST] Processing action for session:', sessionId);
    console.log('🧪 [TEST] Action:', action, 'Data:', JSON.stringify(data));

    if (!sessionId || !action) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'ID da sessão e ação são obrigatórios',
      });
      return;
    }

    // Get session
    const sessionDoc = await sessionsCollection().doc(sessionId).get();

    if (!sessionDoc.exists) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Sessão não encontrada',
      });
      return;
    }

    const sessionData = sessionDoc.data() as OnboardingSession;

    // Process action (async - may use AI for extraction)
    const { session, newMessages } = await processAction(sessionData, action, data);

    // Check if onboarding is complete
    let establishmentId: string | undefined;

    if (isComplete(session)) {
      establishmentId = await createEstablishmentFromSession(session, MOCK_USER.uid);
      console.log('🧪 [TEST] Created establishment:', establishmentId);
    }

    // Update session
    await sessionsCollection().doc(sessionId).update({
      state: session.state,
      messages: session.messages,
      data: session.data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const response: ChatResponse = {
      messages: newMessages,
      state: session.state,
      isComplete: isComplete(session),
      establishmentId,
    };

    console.log('🧪 [TEST] Response state:', session.state, 'New messages:', newMessages.length);

    res.json(response);
  } catch (error) {
    console.error('🧪 [TEST] Error processing action:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao processar ação',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /test/chat/reset
 * Reset all test sessions (for clean testing)
 */
router.delete('/reset', async (req: Request, res: Response) => {
  try {
    console.log('🧪 [TEST] Resetting all test sessions for user:', MOCK_USER.uid);

    // Find all sessions for mock user
    const snapshot = await sessionsCollection()
      .where('userId', '==', MOCK_USER.uid)
      .get();

    if (snapshot.empty) {
      res.json({
        success: true,
        message: 'Nenhuma sessão encontrada para resetar',
        deletedCount: 0,
      });
      return;
    }

    // Delete all sessions
    const batch = sessionsCollection().firestore.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log('🧪 [TEST] Deleted', snapshot.size, 'sessions');

    res.json({
      success: true,
      message: `${snapshot.size} sessão(ões) removida(s)`,
      deletedCount: snapshot.size,
    });
  } catch (error) {
    console.error('🧪 [TEST] Error resetting sessions:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao resetar sessões',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /test/chat/establishments
 * List all establishments (dev only)
 */
router.get('/establishments', async (req: Request, res: Response) => {
  try {
    const snapshot = await collections.establishments.get();
    const establishments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json({ establishments });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * DELETE /test/user/reset
 * Reset a user's establishment and data (for testing stuck users)
 * Pass userId in query params: /test/chat/user-reset?uid=xxx
 * Or use ?uid=* to delete ALL establishments (dev only)
 */
router.delete('/user-reset', async (req: Request, res: Response) => {
  try {
    const userId = req.query.uid as string;

    if (!userId) {
      res.status(400).json({
        error: 'Missing uid',
        message: 'Provide ?uid=xxx in query params (use * for all)',
      });
      return;
    }

    // Wildcard: delete ALL
    if (userId === '*') {
      console.log('🧪 [TEST] Deleting ALL establishments and data!');

      const estSnapshot = await collections.establishments.get();
      let deletedEstablishments = 0;
      let deletedEmployees = 0;

      for (const doc of estSnapshot.docs) {
        const empSnapshot = await collections.employees
          .where('establishmentId', '==', doc.id)
          .get();
        for (const empDoc of empSnapshot.docs) {
          await empDoc.ref.delete();
          deletedEmployees++;
        }
        await doc.ref.delete();
        deletedEstablishments++;
      }

      // Delete all sessions
      const sessionSnapshot = await sessionsCollection().get();
      let deletedSessions = 0;
      for (const doc of sessionSnapshot.docs) {
        await doc.ref.delete();
        deletedSessions++;
      }

      res.json({
        success: true,
        message: 'ALL data reset',
        deleted: {
          establishments: deletedEstablishments,
          employees: deletedEmployees,
          sessions: deletedSessions,
        },
      });
      return;
    }

    console.log('🧪 [TEST] Resetting all data for user:', userId);

    // Find and delete establishments
    const estSnapshot = await collections.establishments
      .where('ownerId', '==', userId)
      .get();

    let deletedEstablishments = 0;
    let deletedEmployees = 0;
    let deletedSessions = 0;

    for (const doc of estSnapshot.docs) {
      // Delete employees for this establishment
      const empSnapshot = await collections.employees
        .where('establishmentId', '==', doc.id)
        .get();

      for (const empDoc of empSnapshot.docs) {
        await empDoc.ref.delete();
        deletedEmployees++;
      }

      await doc.ref.delete();
      deletedEstablishments++;
    }

    // Delete onboarding sessions
    const sessionSnapshot = await sessionsCollection()
      .where('userId', '==', userId)
      .get();

    for (const doc of sessionSnapshot.docs) {
      await doc.ref.delete();
      deletedSessions++;
    }

    console.log('🧪 [TEST] Deleted:', {
      establishments: deletedEstablishments,
      employees: deletedEmployees,
      sessions: deletedSessions,
    });

    res.json({
      success: true,
      message: 'User data reset',
      deleted: {
        establishments: deletedEstablishments,
        employees: deletedEmployees,
        sessions: deletedSessions,
      },
    });
  } catch (error) {
    console.error('🧪 [TEST] Error resetting user:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao resetar usuário',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Create establishment from completed onboarding session
 */
async function createEstablishmentFromSession(
  session: OnboardingSession,
  userId: string
): Promise<string> {
  const data = session.data;

  // Create establishment document
  const establishment = {
    name: data.name || 'Meu Negócio',
    type: data.type || 'other',
    ownerId: userId,
    operatingHours: data.operatingHours || {},
    settings: {
      minEmployeesPerShift: data.minEmployeesPerShift || 2,
      swapsAllowed: data.swapsAllowed ?? true,
      swapsRequireApproval: data.swapsRequireApproval ?? true,
      maxSwapsPerMonth: 4,
    },
    status: 'active',
    onboardingStep: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const docRef = await collections.establishments.add(establishment);

  // Create employees if any
  if (data.employees && data.employees.length > 0) {
    const batch = collections.establishments.firestore.batch();

    for (const emp of data.employees) {
      if (emp.name && emp.phone) {
        const empRef = collections.employees.doc();
        batch.set(empRef, {
          establishmentId: docRef.id,
          name: emp.name,
          phone: emp.phone.replace(/\D/g, ''),
          status: 'pending',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await batch.commit();
  }

  return docRef.id;
}

export default router;
