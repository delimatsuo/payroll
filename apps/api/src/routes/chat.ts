/**
 * Chat Routes for Conversational Onboarding
 *
 * POST /chat/start    - Start a new onboarding session
 * POST /chat/message  - Send a user message
 * GET  /chat/session/:id - Get session state (for reconnection)
 * POST /chat/action   - Handle button/component actions
 * POST /chat/skip     - Skip to CRUD onboarding
 */

import { Router, Request, Response } from 'express';
import { collections } from '../services/firebase';
import { requireAuth, loadEstablishment } from '../middleware/auth';
import {
  createSession,
  processMessage,
  processAction,
  isComplete,
} from '../services/chatStateMachine';
import {
  OnboardingSession,
  ChatResponse,
  DayHours,
} from '../types/chat';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

// All routes require authentication
router.use(requireAuth);
router.use(loadEstablishment);

// Firestore collection for chat sessions
const sessionsCollection = () => collections.establishments.firestore.collection('onboarding_sessions');

/**
 * POST /chat/start
 * Start a new onboarding chat session
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    // Check if user already has an establishment
    if (req.establishmentId) {
      res.status(400).json({
        error: 'Já existe',
        message: 'Você já possui um estabelecimento cadastrado',
      });
      return;
    }

    // Check for existing incomplete session (simple query to avoid index requirement)
    const existingSnapshot = await sessionsCollection()
      .where('userId', '==', req.user!.uid)
      .get();

    // Filter in memory to find incomplete sessions
    const incompleteSessions = existingSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() as OnboardingSession }))
      .filter(s => s.state !== 'complete')
      .sort((a, b) => {
        // Sort by updatedAt descending (most recent first)
        const aTime = a.updatedAt?.toMillis?.() || 0;
        const bTime = b.updatedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

    if (incompleteSessions.length > 0) {
      // Resume existing session
      const session = incompleteSessions[0];

      res.json({
        sessionId: session.id,
        messages: session.messages,
        state: session.state,
        data: session.data,
      });
      return;
    }

    // Create new session
    const session = await createSession(req.user!.uid);

    // Save to Firestore
    await sessionsCollection().doc(session.id).set({
      ...session,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      sessionId: session.id,
      messages: session.messages,
      state: session.state,
    });
  } catch (error) {
    console.error('Error starting chat session:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao iniciar conversa',
    });
  }
});

/**
 * POST /chat/message
 * Send a user message and get agent response
 */
router.post('/message', async (req: Request, res: Response) => {
  try {
    const { sessionId, content } = req.body;

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

    // Verify ownership
    if (sessionData.userId !== req.user!.uid) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Esta sessão não pertence a você',
      });
      return;
    }

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
      establishmentId = await createEstablishmentFromSession(session, req.user!.uid);
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

    res.json(response);
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao processar mensagem',
    });
  }
});

/**
 * GET /chat/session/:id
 * Get session state for reconnection
 */
router.get('/session/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const sessionDoc = await sessionsCollection().doc(id).get();

    if (!sessionDoc.exists) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Sessão não encontrada',
      });
      return;
    }

    const sessionData = sessionDoc.data() as OnboardingSession;

    // Verify ownership
    if (sessionData.userId !== req.user!.uid) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Esta sessão não pertence a você',
      });
      return;
    }

    res.json({
      sessionId: sessionDoc.id,
      messages: sessionData.messages,
      state: sessionData.state,
      data: sessionData.data,
      isComplete: sessionData.state === 'complete',
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar sessão',
    });
  }
});

/**
 * POST /chat/action
 * Handle button clicks and component interactions
 */
router.post('/action', async (req: Request, res: Response) => {
  try {
    const { sessionId, action, data } = req.body;

    console.log('[Chat Action] Received:', { sessionId, action, dataKeys: data ? Object.keys(data) : null });
    if (data?.employees) {
      console.log('[Chat Action] Employees data:', JSON.stringify(data.employees));
    }

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

    // Verify ownership
    if (sessionData.userId !== req.user!.uid) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Esta sessão não pertence a você',
      });
      return;
    }

    console.log('[Chat Action] Session state before processing:', sessionData.state);
    console.log('[Chat Action] Session employees before processing:', sessionData.data?.employees?.length || 0);

    // Process action (async - may use AI for extraction)
    const { session, newMessages } = await processAction(sessionData, action, data);

    console.log('[Chat Action] Session state after processing:', session.state);
    console.log('[Chat Action] Session employees after processing:', session.data?.employees?.length || 0);

    // Check if onboarding is complete
    let establishmentId: string | undefined;

    if (isComplete(session)) {
      console.log('[Chat Action] Onboarding complete! Creating establishment with employees:', session.data?.employees?.length || 0);
      establishmentId = await createEstablishmentFromSession(session, req.user!.uid);
      console.log('[Chat Action] Establishment created:', establishmentId);
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

    res.json(response);
  } catch (error) {
    console.error('Error processing action:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao processar ação',
    });
  }
});

/**
 * POST /chat/skip
 * Skip chat onboarding and go to CRUD mode
 */
router.post('/skip', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (sessionId) {
      // Mark session as skipped
      await sessionsCollection().doc(sessionId).update({
        state: 'complete',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    res.json({
      success: true,
      message: 'Você será redirecionado para o cadastro manual',
      redirect: '/onboarding/name',
    });
  } catch (error) {
    console.error('Error skipping chat:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao pular chat',
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

  console.log('[createEstablishment] Data received:', JSON.stringify(data, null, 2));

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
  console.log('[createEstablishment] Establishment created with ID:', docRef.id);

  // Create employees if any
  console.log('[createEstablishment] Employees to create:', data.employees?.length || 0);
  if (data.employees && data.employees.length > 0) {
    const batch = collections.establishments.firestore.batch();
    let employeesCreated = 0;

    for (const emp of data.employees) {
      console.log('[createEstablishment] Processing employee:', emp);
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
        employeesCreated++;
      } else {
        console.log('[createEstablishment] Skipping employee - missing name or phone:', emp);
      }
    }

    await batch.commit();
    console.log('[createEstablishment] Employees created:', employeesCreated);
  }

  return docRef.id;
}

export default router;
