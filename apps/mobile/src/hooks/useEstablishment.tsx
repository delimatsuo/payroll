/**
 * Establishment Hook - Manages current establishment state
 * Supports multiple establishments per user (restaurant chains, etc.)
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, Establishment, Employee } from '../services/api';
import { useAuth } from './useAuth';

const ACTIVE_ESTABLISHMENT_KEY = '@escala_simples:active_establishment_id';

interface EstablishmentContextType {
  // Multi-establishment support
  establishments: Establishment[];
  establishment: Establishment | null;
  activeEstablishmentId: string | null;
  switchEstablishment: (id: string) => Promise<void>;
  // Employees for current establishment
  employees: Employee[];
  // State
  loading: boolean;
  error: string | null;
  // Actions
  refreshEstablishments: () => Promise<void>;
  refreshEstablishment: () => Promise<void>;
  refreshEmployees: () => Promise<void>;
  addEmployee: (name: string, phone: string) => Promise<{ success: boolean; error?: string }>;
  updateEmployee: (id: string, data: { name?: string; phone?: string; status?: string }) => Promise<{ success: boolean; error?: string }>;
  removeEmployee: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const EstablishmentContext = createContext<EstablishmentContextType | undefined>(undefined);

export function EstablishmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [activeEstablishmentId, setActiveEstablishmentId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);
  const activeIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    activeIdRef.current = activeEstablishmentId;
  }, [activeEstablishmentId]);

  // Derived state: current establishment
  const establishment = establishments.find(e => e.id === activeEstablishmentId) || null;

  // Load persisted active establishment ID
  useEffect(() => {
    const loadPersistedEstablishment = async () => {
      try {
        const storedId = await AsyncStorage.getItem(ACTIVE_ESTABLISHMENT_KEY);
        if (storedId) {
          setActiveEstablishmentId(storedId);
          api.setActiveEstablishment(storedId);
        }
      } catch (err) {
        console.error('Failed to load persisted establishment:', err);
      }
    };
    loadPersistedEstablishment();
  }, []);

  // Switch to a different establishment
  const switchEstablishment = useCallback(async (id: string) => {
    const exists = establishments.some(e => e.id === id);
    if (!exists) {
      console.warn('Attempted to switch to non-existent establishment:', id);
      return;
    }

    setActiveEstablishmentId(id);
    api.setActiveEstablishment(id);

    // Persist selection
    try {
      await AsyncStorage.setItem(ACTIVE_ESTABLISHMENT_KEY, id);
    } catch (err) {
      console.error('Failed to persist establishment selection:', err);
    }

    // Clear employees so they reload for new establishment
    setEmployees([]);
  }, [establishments]);

  // Load all establishments for the user (v2 - with direct employee fetch)
  const refreshEstablishments = useCallback(async () => {
    if (!user) {
      setEstablishments([]);
      setActiveEstablishmentId(null);
      api.setActiveEstablishment(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await api.getEstablishments();

      if (Array.isArray(result)) {
        setEstablishments(result);

        // Auto-select if none selected or selection no longer valid
        // Use ref to avoid dependency loop
        if (result.length > 0) {
          const currentId = activeIdRef.current;
          const currentStillValid = currentId && result.some(e => e.id === currentId);

          if (!currentStillValid) {
            // Select first establishment
            const firstId = result[0].id;
            setActiveEstablishmentId(firstId);
            api.setActiveEstablishment(firstId);
            await AsyncStorage.setItem(ACTIVE_ESTABLISHMENT_KEY, firstId);

            // Directly fetch employees now that API has the establishment ID set
            try {
              const empResult = await api.getEmployees();
              if (Array.isArray(empResult)) {
                setEmployees(empResult);
              }
            } catch (empErr) {
              console.error('Error fetching employees:', empErr);
            }
          } else {
            // Also fetch employees for existing establishment
            api.setActiveEstablishment(currentId);
            try {
              const empResult = await api.getEmployees();
              if (Array.isArray(empResult)) {
                setEmployees(empResult);
              }
            } catch (empErr) {
              console.error('Error fetching employees:', empErr);
            }
          }
        } else {
          // No establishments
          setActiveEstablishmentId(null);
          api.setActiveEstablishment(null);
          await AsyncStorage.removeItem(ACTIVE_ESTABLISHMENT_KEY);
        }
      } else if ((result as any).success === false) {
        setEstablishments([]);
      }
    } catch (err) {
      console.error('Erro ao carregar estabelecimentos:', err);
      setError('Não foi possível carregar os estabelecimentos');
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [user]); // Removed activeEstablishmentId dependency

  // Refresh single establishment (for updates)
  const refreshEstablishment = useCallback(async () => {
    if (!activeEstablishmentId) return;

    try {
      const result = await api.getEstablishment();

      if (result.success !== false && result.id) {
        // Update in establishments array
        setEstablishments(prev =>
          prev.map(e => e.id === result.id ? (result as unknown as Establishment) : e)
        );
      }
    } catch (err) {
      console.error('Erro ao atualizar estabelecimento:', err);
    }
  }, [activeEstablishmentId]);

  const refreshEmployees = useCallback(async () => {
    if (!activeEstablishmentId) {
      setEmployees([]);
      return;
    }

    try {
      const result = await api.getEmployees();

      // Result is an array when successful
      if (Array.isArray(result)) {
        setEmployees(result as Employee[]);
      } else if ((result as any).success === false) {
        setEmployees([]);
      }
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
    }
  }, [activeEstablishmentId]);

  const addEmployee = async (name: string, phone: string) => {
    if (!establishment) {
      return { success: false, error: 'Nenhum estabelecimento selecionado' };
    }

    try {
      const result = await api.createEmployee({ name, phone });

      if (result.success !== false && result.id) {
        // Result contains the employee data directly
        const newEmployee = result as unknown as Employee;
        setEmployees((prev) => [...prev, newEmployee]);
        return { success: true };
      }

      return { success: false, error: result.message || 'Não foi possível adicionar o funcionário' };
    } catch (err) {
      console.error('Erro ao adicionar funcionário:', err);
      return { success: false, error: 'Ocorreu um erro inesperado' };
    }
  };

  const updateEmployee = async (id: string, data: { name?: string; phone?: string; status?: string }) => {
    try {
      const result = await api.updateEmployee(id, data);

      if (result.success) {
        // Update local state with new data
        setEmployees((prev) =>
          prev.map((emp) => (emp.id === id ? { ...emp, ...data } as Employee : emp))
        );
        return { success: true };
      }

      return { success: false, error: result.message || 'Não foi possível atualizar o funcionário' };
    } catch (err) {
      console.error('Erro ao atualizar funcionário:', err);
      return { success: false, error: 'Ocorreu um erro inesperado' };
    }
  };

  const removeEmployee = async (id: string) => {
    try {
      const result = await api.deleteEmployee(id);

      if (result.success) {
        setEmployees((prev) => prev.filter((emp) => emp.id !== id));
        return { success: true };
      }

      return { success: false, error: result.message || 'Não foi possível remover o funcionário' };
    } catch (err) {
      console.error('Erro ao remover funcionário:', err);
      return { success: false, error: 'Ocorreu um erro inesperado' };
    }
  };

  // Load establishments when user changes
  useEffect(() => {
    refreshEstablishments();
  }, [refreshEstablishments]);

  // Load employees when active establishment changes or becomes available
  useEffect(() => {
    if (activeEstablishmentId && initialLoadDone.current) {
      refreshEmployees();
    }
  }, [activeEstablishmentId, refreshEmployees]);

  return (
    <EstablishmentContext.Provider
      value={{
        establishments,
        establishment,
        activeEstablishmentId,
        switchEstablishment,
        employees,
        loading,
        error,
        refreshEstablishments,
        refreshEstablishment,
        refreshEmployees,
        addEmployee,
        updateEmployee,
        removeEmployee,
      }}
    >
      {children}
    </EstablishmentContext.Provider>
  );
}

export function useEstablishment() {
  const context = useContext(EstablishmentContext);
  if (context === undefined) {
    throw new Error('useEstablishment must be used within an EstablishmentProvider');
  }
  return context;
}
