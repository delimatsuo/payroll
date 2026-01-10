/**
 * Onboarding Context
 * Manages onboarding state across screens
 */

import { createContext, useContext, useState, ReactNode } from 'react';
import { api, Establishment, OperatingHours, EstablishmentSettings } from '../services/api';

interface OnboardingState {
  // Step 1: Name and type
  establishmentName: string;
  establishmentType: 'restaurant' | 'store' | 'bar' | 'other';

  // Created establishment
  establishment: Establishment | null;

  // Step 2: Operating hours
  operatingHours: Record<number, OperatingHours>;

  // Step 3: Settings
  settings: Partial<EstablishmentSettings>;
}

interface OnboardingContextType {
  state: OnboardingState;
  setEstablishmentName: (name: string) => void;
  setEstablishmentType: (type: 'restaurant' | 'store' | 'bar' | 'other') => void;
  setOperatingHours: (hours: Record<number, OperatingHours>) => void;
  setSettings: (settings: Partial<EstablishmentSettings>) => void;

  // API actions
  createEstablishment: () => Promise<{ success: boolean; error?: string }>;
  saveOperatingHours: () => Promise<{ success: boolean; error?: string }>;
  saveSettings: () => Promise<{ success: boolean; error?: string }>;
  activateEstablishment: () => Promise<{ success: boolean; error?: string }>;
}

const DEFAULT_OPERATING_HOURS: Record<number, OperatingHours> = {
  0: { isOpen: false, openTime: '10:00', closeTime: '22:00' },
  1: { isOpen: true, openTime: '10:00', closeTime: '22:00' },
  2: { isOpen: true, openTime: '10:00', closeTime: '22:00' },
  3: { isOpen: true, openTime: '10:00', closeTime: '22:00' },
  4: { isOpen: true, openTime: '10:00', closeTime: '22:00' },
  5: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
  6: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
};

const DEFAULT_SETTINGS: Partial<EstablishmentSettings> = {
  minEmployeesPerShift: 2,
  swapsAllowed: true,
  swapsRequireApproval: true,
  maxSwapsPerMonth: 4,
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>({
    establishmentName: '',
    establishmentType: 'restaurant',
    establishment: null,
    operatingHours: DEFAULT_OPERATING_HOURS,
    settings: DEFAULT_SETTINGS,
  });

  const setEstablishmentName = (name: string) => {
    setState((prev) => ({ ...prev, establishmentName: name }));
  };

  const setEstablishmentType = (type: 'restaurant' | 'store' | 'bar' | 'other') => {
    setState((prev) => ({ ...prev, establishmentType: type }));
  };

  const setOperatingHours = (hours: Record<number, OperatingHours>) => {
    setState((prev) => ({ ...prev, operatingHours: hours }));
  };

  const setSettings = (settings: Partial<EstablishmentSettings>) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...settings } }));
  };

  const createEstablishment = async () => {
    try {
      // Create establishment
      const result = await api.createEstablishment({
        name: state.establishmentName,
        type: state.establishmentType,
      });

      if (result.success === false) {
        return {
          success: false,
          error: result.message || 'Não foi possível criar o estabelecimento',
        };
      }

      // Result contains the establishment data directly
      if (result.id) {
        setState((prev) => ({
          ...prev,
          establishment: result as unknown as Establishment,
        }));
        return { success: true };
      }

      return { success: false, error: 'Resposta inesperada do servidor' };
    } catch (error) {
      console.error('Error in createEstablishment:', error);
      return { success: false, error: 'Ocorreu um erro inesperado' };
    }
  };

  const saveOperatingHours = async () => {
    if (!state.establishment) {
      return { success: false, error: 'Nenhum estabelecimento criado' };
    }

    try {
      const result = await api.updateOperatingHours(state.operatingHours);

      if (result.success === false) {
        return {
          success: false,
          error: result.message || 'Não foi possível salvar os horários',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error saving operating hours:', error);
      return { success: false, error: 'Ocorreu um erro inesperado' };
    }
  };

  const saveSettings = async () => {
    if (!state.establishment) {
      return { success: false, error: 'Nenhum estabelecimento criado' };
    }

    try {
      const result = await api.updateSettings(state.settings as EstablishmentSettings);

      if (result.success === false) {
        return {
          success: false,
          error: result.message || 'Não foi possível salvar as configurações',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error saving settings:', error);
      return { success: false, error: 'Ocorreu um erro inesperado' };
    }
  };

  const activateEstablishment = async () => {
    if (!state.establishment) {
      return { success: false, error: 'Nenhum estabelecimento criado' };
    }

    try {
      const result = await api.activateEstablishment();

      if (result.success === false) {
        return {
          success: false,
          error: result.message || 'Não foi possível ativar o estabelecimento',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error activating establishment:', error);
      return { success: false, error: 'Ocorreu um erro inesperado' };
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        state,
        setEstablishmentName,
        setEstablishmentType,
        setOperatingHours,
        setSettings,
        createEstablishment,
        saveOperatingHours,
        saveSettings,
        activateEstablishment,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
