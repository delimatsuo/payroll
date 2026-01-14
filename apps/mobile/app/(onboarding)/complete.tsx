/**
 * Onboarding Complete Screen
 * Step 2 of 2 - Review and activate establishment
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, fontSize, borderRadius, shadows } from '../../src/theme';
import { api, Establishment } from '../../src/services/api';

const ESTABLISHMENT_TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurante',
  store: 'Loja',
  bar: 'Bar',
  other: 'Outro',
};

export default function OnboardingCompleteScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState(false);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [fetchingData, setFetchingData] = useState(true);

  useEffect(() => {
    const fetchEstablishment = async () => {
      try {
        const result = await api.getEstablishment();
        if (result.success !== false && result.id) {
          setEstablishment(result as unknown as Establishment);
        }
      } catch (error) {
        console.error('Error fetching establishment:', error);
      } finally {
        setFetchingData(false);
      }
    };

    fetchEstablishment();
  }, []);

  const handleActivate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      const result = await api.activateEstablishment();

      if (result.success !== false) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setActivated(true);
      } else {
        Alert.alert('Erro', result.message || 'Não foi possível ativar o estabelecimento');
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToApp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(tabs)' as Href);
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  if (fetchingData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Progress Indicator - Step 2 of 2 */}
      <View style={styles.progress}>
        <View style={styles.progressDot} />
        <View style={[styles.progressDot, styles.progressDotActive]} />
      </View>

      {!activated ? (
        <>
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
            <Text style={styles.title}>Tudo pronto!</Text>
            <Text style={styles.subtitle}>
              Confirme os dados e ative seu estabelecimento
            </Text>
          </Animated.View>

          <View style={styles.content}>
            {/* Summary Card */}
            <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary[100] }]}>
                  <Ionicons name="storefront" size={20} color={colors.primary[600]} />
                </View>
                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryLabel}>Estabelecimento</Text>
                  <Text style={styles.summaryValue}>{establishment?.name || 'Não informado'}</Text>
                </View>
              </View>

              <View style={styles.separator} />

              <View style={styles.summaryRow}>
                <View style={[styles.iconContainer, { backgroundColor: colors.info.light }]}>
                  <Ionicons name="pricetag" size={20} color={colors.info.main} />
                </View>
                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryLabel}>Tipo</Text>
                  <Text style={styles.summaryValue}>
                    {ESTABLISHMENT_TYPE_LABELS[establishment?.type || ''] || 'Não informado'}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Info Card */}
            <Animated.View entering={FadeInDown.duration(300).delay(200)} style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color={colors.info.main} />
              <Text style={styles.infoText}>
                Você pode configurar horários de funcionamento, regras de troca e outras opções nas Configurações após ativar.
              </Text>
            </Animated.View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              onPress={handleBack}
            >
              <Text style={styles.backButtonText}>Voltar</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                loading && styles.buttonDisabled,
                pressed && !loading && styles.buttonPressed,
              ]}
              onPress={handleActivate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <Text style={styles.buttonText}>Ativar estabelecimento</Text>
              )}
            </Pressable>
          </View>
        </>
      ) : (
        <>
          {/* Success State */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.successContent}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={80} color={colors.success.main} />
            </View>
            <Text style={styles.successTitle}>Estabelecimento ativado!</Text>
            <Text style={styles.successSubtitle}>
              Seu estabelecimento está pronto. Agora você pode gerenciar funcionários e criar escalas.
            </Text>
          </Animated.View>

          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleGoToApp}
            >
              <Text style={styles.buttonText}>Começar a usar</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Progress
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral[200],
  },
  progressDotActive: {
    backgroundColor: colors.primary[600],
    width: 24,
  },
  // Header
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.largeTitle,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.body,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  // Content
  content: {
    flex: 1,
    gap: spacing.lg,
  },
  // Summary Card
  summaryCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  summaryLabel: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    marginBottom: spacing.xxs,
  },
  summaryValue: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.light,
    marginLeft: 40 + spacing.md,
  },
  // Info Card
  infoCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.info.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.footnote,
    color: colors.info.dark,
    lineHeight: 20,
  },
  // Success State
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  successIcon: {
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: fontSize.largeTitle,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: fontSize.body,
    color: colors.text.secondary,
    lineHeight: 24,
    textAlign: 'center',
  },
  // Footer
  footer: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    fontSize: fontSize.body,
    color: colors.primary[600],
    fontWeight: '600',
  },
  button: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    ...shadows.md,
  },
  buttonDisabled: {
    backgroundColor: colors.neutral[300],
    shadowOpacity: 0,
  },
  buttonPressed: {
    backgroundColor: colors.primary[700],
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.inverse,
  },
});
