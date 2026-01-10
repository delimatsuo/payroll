import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius, shadows } from '../../src/theme';
import { useOnboarding } from '../../src/hooks';

const ESTABLISHMENT_TYPES = [
  { id: 'restaurant', label: 'Restaurante', icon: '🍽️' },
  { id: 'store', label: 'Loja', icon: '🏪' },
  { id: 'bar', label: 'Bar', icon: '🍺' },
  { id: 'other', label: 'Outro', icon: '🏢' },
] as const;

export default function OnboardingNameScreen() {
  const router = useRouter();
  const {
    state,
    setEstablishmentName,
    setEstablishmentType,
    createEstablishment,
  } = useOnboarding();

  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      const result = await createEstablishment();

      if (result.success) {
        router.push('/(onboarding)/hours');
      } else {
        Alert.alert('Erro', result.error || 'Não foi possível criar a empresa');
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeSelect = (type: typeof ESTABLISHMENT_TYPES[number]['id']) => {
    Haptics.selectionAsync();
    setEstablishmentType(type);
  };

  const isValid = state.establishmentName.trim().length >= 2;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        {/* Progress Indicator - Step 1 of 5 */}
        <View style={styles.progress}>
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Vamos começar!</Text>
          <Text style={styles.subtitle}>
            Conte um pouco sobre sua empresa
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome da empresa</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Restaurante do Carlos"
              placeholderTextColor={colors.text.quaternary}
              value={state.establishmentName}
              onChangeText={setEstablishmentName}
              autoCapitalize="words"
              autoFocus
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo de negócio</Text>
            <View style={styles.typeContainer}>
              {ESTABLISHMENT_TYPES.map((type) => (
                <Pressable
                  key={type.id}
                  style={({ pressed }) => [
                    styles.typeButton,
                    state.establishmentType === type.id && styles.typeButtonActive,
                    pressed && styles.typeButtonPressed,
                  ]}
                  onPress={() => handleTypeSelect(type.id)}
                >
                  <Text style={styles.typeIcon}>{type.icon}</Text>
                  <Text
                    style={[
                      styles.typeButtonText,
                      state.establishmentType === type.id && styles.typeButtonTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              (!isValid || loading) && styles.buttonDisabled,
              pressed && isValid && !loading && styles.buttonPressed,
            ]}
            onPress={handleContinue}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.buttonText}>Continuar</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
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
  // Form
  form: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.footnote,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.body,
    color: colors.text.primary,
  },
  // Type Selection
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.elevated,
    gap: spacing.sm,
    ...shadows.sm,
  },
  typeButtonActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  typeButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  typeIcon: {
    fontSize: 20,
  },
  typeButtonText: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: colors.primary[600],
    fontWeight: '600',
  },
  // Footer
  footer: {
    marginTop: 'auto',
    marginBottom: spacing.xl,
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
