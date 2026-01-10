/**
 * Employee Authentication Hook
 * Handles phone-based OTP authentication for employees
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, EmployeeUser, EmployeeEstablishmentLink } from '../services/api';
import { authService } from '../services/firebase';

const EMPLOYEE_USER_KEY = '@escala_simples:employee_user';
const ACTIVE_EMPLOYEE_LINK_KEY = '@escala_simples:active_employee_link';

type OtpStep = 'phone' | 'otp' | 'authenticated';

interface EmployeeAuthContextType {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  otpStep: OtpStep;
  user: EmployeeUser | null;
  activeLink: EmployeeEstablishmentLink | null;
  error: string | null;

  // OTP Flow
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
  const [otpStep, setOtpStep] = useState<OtpStep>('phone');
  const [user, setUser] = useState<EmployeeUser | null>(null);
  const [activeLink, setActiveLink] = useState<EmployeeEstablishmentLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  const isAuthenticated = !!user && otpStep === 'authenticated';

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
          setOtpStep('authenticated');

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

  // Request OTP
  const requestOtp = useCallback(async (phone: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await api.requestOtp(phone);

      if (result.success) {
        setPendingPhone(phone);
        setOtpStep('otp');
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

  // Verify OTP
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
        setOtpStep('authenticated');

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
      setOtpStep('phone');
      setPendingPhone(null);
    } catch (err) {
      console.error('Error during logout:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reset flow (go back to phone step)
  const resetFlow = useCallback(() => {
    setOtpStep('phone');
    setError(null);
    setPendingPhone(null);
  }, []);

  return (
    <EmployeeAuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        otpStep,
        user,
        activeLink,
        error,
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
