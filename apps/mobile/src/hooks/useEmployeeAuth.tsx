/**
 * Employee Authentication Hook
 * Handles phone + PIN authentication for employees
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, EmployeeUser, EmployeeEstablishmentLink } from '../services/api';
import { authService } from '../services/firebase';

const EMPLOYEE_USER_KEY = '@escala_simples:employee_user';
const ACTIVE_EMPLOYEE_LINK_KEY = '@escala_simples:active_employee_link';

type AuthStep = 'login' | 'authenticated';

interface EmployeeAuthContextType {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  authStep: AuthStep;
  user: EmployeeUser | null;
  activeLink: EmployeeEstablishmentLink | null;
  error: string | null;

  // PIN Login
  loginWithPin: (phone: string, pin: string) => Promise<{ success: boolean; error?: string }>;

  // Legacy OTP Flow (deprecated)
  otpStep: 'phone' | 'otp' | 'authenticated';
  requestOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  resendOtp: () => Promise<{ success: boolean; error?: string }>;

  // Session
  switchEstablishment: (link: EmployeeEstablishmentLink) => void;
  logout: () => Promise<void>;

  // Reset
  resetFlow: () => void;
}

const EmployeeAuthContext = createContext<EmployeeAuthContextType | undefined>(undefined);

export function EmployeeAuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [authStep, setAuthStep] = useState<AuthStep>('login');
  const [user, setUser] = useState<EmployeeUser | null>(null);
  const [activeLink, setActiveLink] = useState<EmployeeEstablishmentLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  const isAuthenticated = !!user && authStep === 'authenticated';

  // Legacy OTP step mapping for backwards compatibility
  const otpStep = authStep === 'authenticated' ? 'authenticated' : 'phone';

  // Load persisted user on mount
  useEffect(() => {
    const loadPersistedUser = async () => {
      try {
        const [storedUser, storedLink] = await Promise.all([
          AsyncStorage.getItem(EMPLOYEE_USER_KEY),
          AsyncStorage.getItem(ACTIVE_EMPLOYEE_LINK_KEY),
        ]);

        if (storedUser) {
          const parsedUser = JSON.parse(storedUser) as EmployeeUser;
          setUser(parsedUser);
          setAuthStep('authenticated');

          if (storedLink) {
            setActiveLink(JSON.parse(storedLink));
          } else if (parsedUser.establishmentLinks.length > 0) {
            setActiveLink(parsedUser.establishmentLinks[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load persisted employee user:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPersistedUser();
  }, []);

  // PIN Login
  const loginWithPin = useCallback(async (phone: string, pin: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await api.pinLogin(phone, pin);

      if (result.success && result.token && result.employee) {
        // Sign in with Firebase custom token
        await authService.signInWithCustomToken(result.token);

        // Create user object from employee data
        const employeeUser: EmployeeUser = {
          id: result.employee.id,
          phone: result.employee.phone,
          name: result.employee.name,
          establishmentLinks: [{
            establishmentId: result.employee.establishmentId,
            employeeId: result.employee.id,
            establishmentName: '', // Will be populated later if needed
          }],
        };

        // Store user
        setUser(employeeUser);
        setAuthStep('authenticated');

        // Set active link
        const defaultLink = employeeUser.establishmentLinks[0];
        setActiveLink(defaultLink);
        await AsyncStorage.setItem(ACTIVE_EMPLOYEE_LINK_KEY, JSON.stringify(defaultLink));

        // Persist user
        await AsyncStorage.setItem(EMPLOYEE_USER_KEY, JSON.stringify(employeeUser));

        return { success: true };
      }

      const errorMsg = result.message || 'Telefone ou PIN incorreto';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } catch (err) {
      const errorMsg = 'Erro ao fazer login. Tente novamente.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Request OTP (deprecated - use loginWithPin instead)
  const requestOtp = useCallback(async (phone: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await api.requestOtp(phone);

      if (result.success) {
        setPendingPhone(phone);
        // Legacy: Just store the phone, actual auth happens in verifyOtp
        return { success: true };
      }

      const errorMsg = result.message || 'Não foi possível enviar o código';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } catch (err) {
      const errorMsg = 'Erro ao enviar código. Tente novamente.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Verify OTP (deprecated - use loginWithPin instead)
  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await api.verifyOtp(phone, otp);

      if (result.success && result.token && result.user) {
        // Sign in with Firebase custom token
        await authService.signInWithCustomToken(result.token);

        // Store user
        setUser(result.user);
        setAuthStep('authenticated');

        // Set default active link
        if (result.user.establishmentLinks.length > 0) {
          const defaultLink = result.user.establishmentLinks[0];
          setActiveLink(defaultLink);
          await AsyncStorage.setItem(ACTIVE_EMPLOYEE_LINK_KEY, JSON.stringify(defaultLink));
        }

        // Persist user
        await AsyncStorage.setItem(EMPLOYEE_USER_KEY, JSON.stringify(result.user));

        return { success: true };
      }

      const errorMsg = result.message || 'Código inválido';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } catch (err) {
      const errorMsg = 'Erro ao verificar código. Tente novamente.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Resend OTP
  const resendOtp = useCallback(async () => {
    if (!pendingPhone) {
      return { success: false, error: 'Telefone não informado' };
    }
    return requestOtp(pendingPhone);
  }, [pendingPhone, requestOtp]);

  // Switch establishment
  const switchEstablishment = useCallback((link: EmployeeEstablishmentLink) => {
    setActiveLink(link);
    AsyncStorage.setItem(ACTIVE_EMPLOYEE_LINK_KEY, JSON.stringify(link));
  }, []);

  // Logout
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.signOut();
      await AsyncStorage.multiRemove([EMPLOYEE_USER_KEY, ACTIVE_EMPLOYEE_LINK_KEY]);
      setUser(null);
      setActiveLink(null);
      setAuthStep('login');
      setPendingPhone(null);
    } catch (err) {
      console.error('Error during logout:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reset flow (go back to login step)
  const resetFlow = useCallback(() => {
    setAuthStep('login');
    setError(null);
    setPendingPhone(null);
  }, []);

  return (
    <EmployeeAuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        authStep,
        otpStep,
        user,
        activeLink,
        error,
        loginWithPin,
        requestOtp,
        verifyOtp,
        resendOtp,
        switchEstablishment,
        logout,
        resetFlow,
      }}
    >
      {children}
    </EmployeeAuthContext.Provider>
  );
}

export function useEmployeeAuth() {
  const context = useContext(EmployeeAuthContext);
  if (context === undefined) {
    throw new Error('useEmployeeAuth must be used within an EmployeeAuthProvider');
  }
  return context;
}
