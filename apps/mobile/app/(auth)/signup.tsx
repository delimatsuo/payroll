/**
 * Signup Screen - Combined Auth + Business Setup
 * Collects: Email, Password, Business Name, Business Type
 * Creates account and establishment in one flow
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, fontSize, borderRadius, shadows } from '../../src/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { api } from '../../src/services/api';

type EstablishmentType = 'restaurant' | 'store' | 'bar' | 'other';

const ESTABLISHMENT_TYPES: { id: EstablishmentType; label: string; icon: string }[] = [
  { id: 'restaurant', label: 'Restaurante', icon: '🍽️' },
  { id: 'store', label: 'Loja', icon: '🏪' },
  { id: 'bar', label: 'Bar', icon: '🍺' },
  { id: 'other', label: 'Outro', icon: '🏢' },
];

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  // Auth fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Business fields
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<EstablishmentType>('restaurant');

  const [loading, setLoading] = useState(false);

  const handleTypeSelect = (type: EstablishmentType) => {
    Haptics.selectionAsync();
    setBusinessType(type);
  };

  const handleSignUp = async () => {
    // Validation
    if (!email.trim() || !password.trim() || !businessName.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }

    if (businessName.trim().length < 2) {
      Alert.alert('Erro', 'Nome da empresa deve ter pelo menos 2 caracteres');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      // Step 1: Create Firebase account
      await signUp(email.trim(), password);

      // Step 2: Create establishment (API will use the new user's token)
      const result = await api.createEstablishment({
        name: businessName.trim(),
        type: businessType,
      });

      if (result.success === false) {
        Alert.alert('Erro', result.message || 'Não foi possível criar a empresa');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Go directly to team setup (skip hours and settings)
      router.replace('/(onboarding)/team' as Href);
    } catch (error: any) {
      console.log('Signup error:', error.code || error.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (error.code === 'auth/email-already-in-use') {
        Alert.alert('Erro', 'Este email já está em uso. Tente fazer login.');
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert('Erro', 'Email inválido');
      } else if (error.code === 'auth/weak-password') {
        Alert.alert('Erro', 'Senha muito fraca. Use pelo menos 6 caracteres.');
      } else {
        Alert.alert('Erro', 'Não foi possível criar a conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isValid =
    email.trim().length > 0 &&
    password.length >= 6 &&
    password === confirmPassword &&
    businessName.trim().length >= 2;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text.link} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Animated.View entering={FadeInDown.duration(300).delay(100)}>
            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>
              Configure sua conta e empresa em poucos passos
            </Text>
          </Animated.View>

          {/* Account Section */}
          <Animated.View entering={FadeInDown.duration(300).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>Sua conta</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                placeholderTextColor={colors.text.quaternary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={colors.text.quaternary}
                  secureTextEntry={!showPassword}
                  textContentType="oneTimeCode"
                  autoComplete="off"
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.text.tertiary}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirmar senha</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite a senha novamente"
                placeholderTextColor={colors.text.quaternary}
                secureTextEntry={!showPassword}
                textContentType="oneTimeCode"
                autoComplete="off"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
          </Animated.View>

          {/* Business Section */}
          <Animated.View entering={FadeInDown.duration(300).delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Sua empresa</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome da empresa</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Restaurante do Carlos"
                placeholderTextColor={colors.text.quaternary}
                autoCapitalize="words"
                value={businessName}
                onChangeText={setBusinessName}
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
                      businessType === type.id && styles.typeButtonActive,
                      pressed && styles.typeButtonPressed,
                    ]}
                    onPress={() => handleTypeSelect(type.id)}
                  >
                    <Text style={styles.typeIcon}>{type.icon}</Text>
                    <Text
                      style={[
                        styles.typeButtonText,
                        businessType === type.id && styles.typeButtonTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* Spacer for scroll */}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              (!isValid || loading) && styles.buttonDisabled,
              pressed && isValid && !loading && styles.buttonPressed,
            ]}
            onPress={handleSignUp}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.buttonText}>Criar conta</Text>
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
  keyboardView: {
    flex: 1,
  },
  header: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    marginLeft: -spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: fontSize.largeTitle,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.body,
    color: colors.text.secondary,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.footnote,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.footnote,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.secondary,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.body,
    color: colors.text.primary,
  },
  eyeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
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
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background.primary,
  },
  button: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    height: 56,
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
    fontSize: fontSize.headline,
    fontWeight: '600',
    color: colors.text.inverse,
  },
});
