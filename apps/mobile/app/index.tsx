import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../src/theme';
import { useAuth } from '../src/hooks/useAuth';
import { api } from '../src/services/api';

export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const checkAuthFlow = async () => {
      // Not logged in - go to login
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
            // Has establishment but not active - needs to complete onboarding
            router.replace('/(onboarding)/team');
          }
        } else {
          // No establishment - go to signup (which now includes business creation)
          router.replace('/(auth)/signup');
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
        // On error, go to signup
        router.replace('/(auth)/signup');
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
