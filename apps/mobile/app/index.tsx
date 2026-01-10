import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, Href } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../src/theme';
import { useAuth } from '../src/hooks/useAuth';
import { api } from '../src/services/api';

const EMPLOYEE_USER_KEY = '@escala_simples:employee_user';

export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [checkingEmployee, setCheckingEmployee] = useState(true);

  useEffect(() => {
    if (loading) return;

    const checkAuthFlow = async () => {
      // First, check if there's a stored employee user
      try {
        const storedEmployee = await AsyncStorage.getItem(EMPLOYEE_USER_KEY);
        if (storedEmployee) {
          // This is an employee - go to employee home
          setCheckingEmployee(false);
          router.replace('/(employee)/home' as Href);
          return;
        }
      } catch (err) {
        console.error('Error checking employee storage:', err);
      }

      setCheckingEmployee(false);

      // Not an employee - check manager/owner flow
      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      try {
        // Check if user has an active establishment
        const result = await api.getEstablishment();

        if (result.success !== false && result.id) {
          // Has establishment
          if (result.status === 'active') {
            router.replace('/(tabs)');
          } else {
            // Has establishment but not active - needs to complete onboarding CRUD
            router.replace('/(onboarding)/name');
          }
        } else {
          // No establishment - start conversational onboarding (chat)
          router.replace('/(onboarding)/chat');
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
        // On error, start with chat onboarding
        router.replace('/(onboarding)/chat');
      }
    };

    // Small delay for splash effect
    const timer = setTimeout(checkAuthFlow, 1000);

    return () => clearTimeout(timer);
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Escala</Text>
      <Text style={styles.logoAccent}>Simples</Text>
      <ActivityIndicator
        size="large"
        color={colors.primary[600]}
        style={styles.loader}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary[600],
  },
  logoAccent: {
    fontSize: 48,
    fontWeight: '300',
    color: colors.text.secondary,
    marginTop: -8,
  },
  loader: {
    marginTop: 48,
  },
});
