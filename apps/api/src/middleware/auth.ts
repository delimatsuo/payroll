import { Request, Response, NextFunction } from 'express';
import { auth, collections } from '../services/firebase';

/**
 * Middleware to verify Firebase ID token
 * Attaches the decoded user to req.user
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Não autorizado',
      message: 'Token de autenticação não fornecido',
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      displayName: decodedToken.name || null,
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({
      error: 'Não autorizado',
      message: 'Token de autenticação inválido ou expirado',
    });
  }
}

/**
 * Middleware to load the user's establishment
 * Must be used after requireAuth
 *
 * Supports multi-establishment:
 * - If X-Establishment-Id header is provided, loads that specific establishment (if user owns it)
 * - Otherwise, loads the first establishment owned by the user (for backwards compatibility)
 */
export async function loadEstablishment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: 'Não autorizado',
      message: 'Usuário não autenticado',
    });
    return;
  }

  try {
    const headerEstablishmentId = req.headers['x-establishment-id'] as string | undefined;

    if (headerEstablishmentId) {
      // Load specific establishment from header (multi-establishment mode)
      const doc = await collections.establishments.doc(headerEstablishmentId).get();

      if (doc.exists && doc.data()?.ownerId === req.user.uid) {
        req.establishmentId = doc.id;
        req.establishment = {
          id: doc.id,
          ...doc.data(),
        } as any;
      }
      // If header provided but invalid/not owned, don't fall back - let requireEstablishment handle it
    } else {
      // Backwards compatible: find first establishment owned by user
      const snapshot = await collections.establishments
        .where('ownerId', '==', req.user.uid)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        req.establishmentId = doc.id;
        req.establishment = {
          id: doc.id,
          ...doc.data(),
        } as any;
      }
    }

    next();
  } catch (error) {
    console.error('Error loading establishment:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao carregar estabelecimento',
    });
  }
}

/**
 * Middleware to require an establishment to exist
 * Must be used after loadEstablishment
 */
export function requireEstablishment(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.establishmentId) {
    res.status(404).json({
      error: 'Não encontrado',
      message: 'Estabelecimento não encontrado. Complete o cadastro primeiro.',
    });
    return;
  }
  next();
}
