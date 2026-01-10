import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius, shadows } from '../../src/theme';
import { useOnboarding } from '../../src/hooks';

const MIN_EMPLOYEES_OPTIONS = [1, 2, 3, 4, 5];
const MAX_SWAPS_OPTIONS = [2, 4, 6, 8, 10];

export default function OnboardingSettingsScreen() {
  const router = useRouter();
  const { state, setSettings, saveSettings } = useOnboarding();
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      const result = await saveSettings();

      if (result.success) {
        router.push('/(onboarding)/team');
      } else {
        Alert.alert('Erro', result.error || 'Não foi possível salvar as configurações');
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleSelectMinEmployees = (num: number) => {
    Haptics.selectionAsync();
    setSettings({ minEmployeesPerShift: num });
  };

  const handleSelectMaxSwaps = (num: number) => {
    Haptics.selectionAsync();
    setSettings({ maxSwapsPerMonth: num });
  };

  const handleToggleSwaps = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings({ swapsAllowed: value });
  };

  const handleToggleApproval = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings({ swapsRequireApproval: value });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Progress Indicator - Step 3 of 5 */}
      <View style={styles.progress}>
        <View style={styles.progressDot} />
        <View style={styles.progressDot} />
        <View style={[styles.progressDot, styles.progressDotActive]} />
        <View style={styles.progressDot} />
        <View style={styles.progressDot} />
      </View>

      {/* Back Button */}
      <Pressable
        style={({ pressed }) => [
          styles.backButton,
          pressed && styles.backButtonPressed,
        ]}
        onPress={handleBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={28} color={colors.primary[600]} />
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Configurações</Text>
        <Text style={styles.subtitle}>
          Defina as regras de funcionamento da sua equipe
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Minimum employees per shift */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary[100] }]}>
              <Ionicons name="people" size={20} color={colors.primary[600]} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Mínimo por turno</Text>
              <Text style={styles.sectionDescription}>
                Funcionários necessários ao mesmo tempo
              </Text>
            </View>
          </View>
          <View style={styles.optionsRow}>
            {MIN_EMPLOYEES_OPTIONS.map((num) => (
              <Pressable
                key={num}
                style={({ pressed }) => [
                  styles.numberOption,
                  state.settings.minEmployeesPerShift === num && styles.numberOptionActive,
                  pressed && styles.numberOptionPressed,
                ]}
                onPress={() => handleSelectMinEmployees(num)}
              >
                <Text
                  style={[
                    styles.numberOptionText,
                    state.settings.minEmployeesPerShift === num && styles.numberOptionTextActive,
                  ]}
                >
                  {num}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Swaps allowed */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.iconContainer, { backgroundColor: colors.success.light }]}>
              <Ionicons name="swap-horizontal" size={20} color={colors.success.main} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Permitir trocas de turno</Text>
              <Text style={styles.cardDescription}>
                Funcionários podem trocar entre si
              </Text>
            </View>
            <Switch
              value={state.settings.swapsAllowed}
              onValueChange={handleToggleSwaps}
              trackColor={{ false: colors.neutral[200], true: colors.success.light }}
              thumbColor={state.settings.swapsAllowed ? colors.success.main : colors.neutral[400]}
              ios_backgroundColor={colors.neutral[200]}
            />
          </View>

          {state.settings.swapsAllowed && (
            <>
              <View style={styles.separator} />

              <View style={styles.cardRow}>
                <View style={[styles.iconContainer, { backgroundColor: colors.warning.light }]}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.warning.main} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Aprovação necessária</Text>
                  <Text style={styles.cardDescription}>
                    Você precisa aprovar cada troca
                  </Text>
                </View>
                <Switch
                  value={state.settings.swapsRequireApproval}
                  onValueChange={handleToggleApproval}
                  trackColor={{ false: colors.neutral[200], true: colors.warning.light }}
                  thumbColor={state.settings.swapsRequireApproval ? colors.warning.main : colors.neutral[400]}
                  ios_backgroundColor={colors.neutral[200]}
                />
              </View>
            </>
          )}
        </View>

        {/* Max swaps per month */}
        {state.settings.swapsAllowed && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.iconContainer, { backgroundColor: colors.system.purple + '20' }]}>
                <Ionicons name="repeat" size={20} color={colors.system.purple} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Máximo de trocas por mês</Text>
                <Text style={styles.sectionDescription}>
                  Limite por funcionário
                </Text>
              </View>
            </View>
            <View style={styles.optionsRow}>
              {MAX_SWAPS_OPTIONS.map((num) => (
                <Pressable
                  key={num}
                  style={({ pressed }) => [
                    styles.numberOption,
                    state.settings.maxSwapsPerMonth === num && styles.numberOptionActive,
                    pressed && styles.numberOptionPressed,
                  ]}
                  onPress={() => handleSelectMaxSwaps(num)}
                >
                  <Text
                    style={[
                      styles.numberOptionText,
                      state.settings.maxSwapsPerMonth === num && styles.numberOptionTextActive,
                    ]}
                  >
                    {num}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            loading && styles.buttonDisabled,
            pressed && !loading && styles.buttonPressed,
          ]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={styles.buttonText}>Continuar</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.grouped,
  },
  // Progress
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
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
  // Back Button
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  // Header
  header: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
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
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  // Sections
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeaderText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  sectionDescription: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  numberOption: {
    flex: 1,
    height: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  numberOptionActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  numberOptionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  numberOptionText: {
    fontSize: fontSize.title3,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  numberOptionTextActive: {
    color: colors.primary[600],
  },
  // Card
  card: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  cardContent: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  cardDescription: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.light,
    marginLeft: 40 + spacing.md * 2, // icon + margins
  },
  // Footer
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background.primary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
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
