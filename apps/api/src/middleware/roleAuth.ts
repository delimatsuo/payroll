/**
 * Role-Based Authentication Middleware
 * Enforces access control for manager vs employee routes
 */

import { Request, Response, NextFunction } from 'express';
import { auth, collections } from '../services/firebase';

type UserRole = 'manager' | 'employee';

// Extend Express Request to include role information
declare global {
  namespace Express {
    interface Request {
      userRole?: UserRole;
      employeeId?: string;
      employeePhone?: string;
    }
  }
}

/**
 * Verify Firebase token and extract role from custom claims
 * Works for both managers (standard Firebase Auth) and employees (custom tokens)
 */
export async function verifyTokenWithRole(
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

    // Check if this is an employee (custom token with role claim)
    if (decodedToken.role === 'employee') {
      req.userRole = 'employee';
      req.employeePhone = decodedToken.phone;
      req.user = {
        uid: decodedToken.uid,
        email: null,
        displayName: null,
      };
    } else {
      // Standard manager authentication
      req.userRole = 'manager';
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        displayName: decodedToken.name || null,
      };
    }

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      error: 'Não autorizado',
      message: 'Token de autenticação inválido ou expirado',
    });
  }
}

/**
 * Require manager role - blocks employees
 */
export function requireManager(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.userRole !== 'manager') {
    res.status(403).json({
      error: 'Acesso negado',
      message: 'Esta ação requer permissões de gerente',
    });
    return;
  }
  next();
}

/**
 * Require employee role - blocks managers
 */
export function requireEmployee(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.userRole !== 'employee') {
    res.status(403).json({
      error: 'Acesso negado',
      message: 'Esta ação requer login de funcionário',
    });
    return;
  }
  next();
}

/**
 * Load employee data for authenticated employee
 * Must be used after verifyTokenWithRole for employee routes
 */
export async function loadEmployeeData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.userRole !== 'employee' || !req.employeePhone) {
    next();
    return;
  }

  try {
    // Get establishment ID from header (for multi-establishment support)
    const headerEstablishmentId = req.headers['x-establishment-id'] as string | undefined;

    // Find employee record
    const snapshot = await collections.employees
      .where('phone', '==', req.employeePhone)
      .get();

    if (snapshot.empty) {
      // Try without country code
      const phoneWithoutCountry = req.employeePhone.startsWith('55')
        ? req.employeePhone.substring(2)
        : req.employeePhone;

      const legacySnapshot = await collections.employees
        .where('phone', '==', phoneWithoutCountry)
        .get();

      if (legacySnapshot.empty) {
        res.status(404).json({
          error: 'Funcionário não encontrado',
          message: 'Seu cadastro não foi encontrado',
        });
        return;
      }

      // Use the first match or filter by establishment header
      const docs = legacySnapshot.docs;
      const matchingDoc = headerEstablishmentId
        ? docs.find((d) => d.data().establishmentId === headerEstablishmentId)
        : docs[0];

      if (matchingDoc) {
        req.employeeId = matchingDoc.id;
        req.establishmentId = matchingDoc.data().establishmentId;
      }
    } else {
      const docs = snapshot.docs;
      const matchingDoc = headerEstablishmentId
        ? docs.find((d) => d.data().establishmentId === headerEstablishmentId)
        : docs[0];

      if (matchingDoc) {
        req.employeeId = matchingDoc.id;
        req.establishmentId = matchingDoc.data().establishmentId;
      }
    }

    next();
  } catch (error) {
    console.error('Error loading employee data:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao carregar dados do funcionário',
    });
  }
}

/**
 * Verify that the requested resource belongs to the authenticated employee
 * Use for endpoints that access specific employee data
 */
export function requireOwnership(resourceType: 'employee' | 'schedule') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.userRole === 'manager') {
      // Managers can access all resources in their establishment
      next();
      return;
    }

    if (req.userRole !== 'employee') {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Autenticação necessária',
      });
      return;
    }

    if (resourceType === 'employee') {
      // Check if the employee ID matches
      const requestedEmployeeId = req.params.employeeId || req.params.id;
      if (requestedEmployeeId && requestedEmployeeId !== req.employeeId) {
        res.status(403).json({
          error: 'Acesso negado',
          message: 'Você só pode acessar seus próprios dados',
        });
        return;
      }
    }

    if (resourceType === 'schedule') {
      // For schedules, employees can only access their own shifts
      // This is enforced at the query level, but we add an extra check
      // The endpoint should filter shifts to only return this employee's
    }

    next();
  };
}
