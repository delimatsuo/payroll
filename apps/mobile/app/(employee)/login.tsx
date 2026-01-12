/**
 * Employee Login Screen
 * Simple phone + PIN authentication flow
 */

import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';
import { useEmployeeAuth } from '../../src/hooks';

export default function EmployeeLoginScreen() {
  const router = useRouter();
  const { isLoading, error, loginWithPin } = useEmployeeAuth();

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const pinInputRefs = useRef<Array<TextInput | null>>([]);

  // Format phone number as user types
  const formatPhoneDisplay = (value: string): string => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const handlePhoneChange = (text: string) => {
    const numbers = text.replace(/\D/g, '');
    setPhone(numbers.slice(0, 11));
  };

  const handlePinChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6);
      const newPin = [...pin];
      digits.split('').forEach((d, i) => {
        if (i + index < 6) newPin[i + index] = d;
      });
      setPin(newPin);

      // Focus last filled or next empty
      const lastIndex = Math.min(index + digits.length, 5);
      pinInputRefs.current[lastIndex]?.focus();
      return;
    }

    const newPin = [...pin];
    newPin[index] = value.replace(/\D/g, '');
    setPin(newPin);

    // Auto-advance
    if (value && index < 5) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !pin[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  const handleLogin = async () => {
    if (phone.length < 10 || !isPinComplete) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await loginWithPin(phone, pin.join(''));

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(employee)/home' as Href);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Clear PIN on error
      setPin(['', '', '', '', '', '']);
      pinInputRefs.current[0]?.focus();
    }
  };

  const isPhoneValid = phone.length >= 10;
  const isPinComplete = pin.every(d => d !== '');
  const canSubmit = isPhoneValid && isPinComplete;

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

        {/* Content */}
        <View style={styles.content}>
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={styles.formContainer}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed-outline" size={48} color={colors.primary[600]} />
            </View>

            <Text style={styles.title}>Entrar como funcionário</Text>
            <Text style={styles.subtitle}>
              Use seu número de celular e o PIN fornecido pelo seu gerente
            </Text>

            {/* Phone Input */}
            <Text style={styles.inputLabel}>Celular</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.countryCode}>+55</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="(00) 00000-0000"
                placeholderTextColor={colors.text.quaternary}
                keyboardType="phone-pad"
                value={formatPhoneDisplay(phone)}
                onChangeText={handlePhoneChange}
                autoFocus
                maxLength={16}
              />
            </View>

            {/* PIN Input */}
            <Text style={styles.inputLabel}>PIN de acesso</Text>
            <View style={styles.pinContainer}>
              {pin.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(el) => { pinInputRefs.current[index] = el; }}
                  style={[
                    styles.pinInput,
                    digit && styles.pinInputFilled,
                  ]}
                  value={digit}
                  onChangeText={(value) => handlePinChange(index, value)}
                  onKeyPress={({ nativeEvent }) => handlePinKeyPress(index, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  secureTextEntry
                />
              ))}
            </View>

            {error && (
              <Animated.Text entering={FadeInDown} style={styles.errorText}>
                {error}
              </Animated.Text>
            )}

            <Pressable
              onPress={handleLogin}
              disabled={!canSubmit || isLoading}
              style={({ pressed }) => [
                styles.primaryButton,
                (!canSubmit || isLoading) && styles.primaryButtonDisabled,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <Text style={styles.primaryButtonText}>Entrar</Text>
              )}
            </Pressable>

            <Text style={styles.helpText}>
              Não tem um PIN?{' '}
              <Text style={styles.helpLink}>
                Solicite ao seu gerente
              </Text>
            </Text>
          </Animated.View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Ao continuar, você concorda com nossos{' '}
            <Text style={styles.footerLink}>Termos de Uso</Text>
          </Text>
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  formContainer: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.title1,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontSize: fontSize.footnote,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
  },
  countryCode: {
    fontSize: fontSize.title3,
    fontWeight: '600',
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  phoneInput: {
    flex: 1,
    fontSize: fontSize.title3,
    fontWeight: '600',
    color: colors.text.primary,
    paddingVertical: spacing.md,
    letterSpacing: 1,
  },
  pinContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    width: '100%',
    justifyContent: 'center',
  },
  pinInput: {
    width: 48,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
    fontSize: fontSize.title2,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  pinInputFilled: {
    backgroundColor: colors.primary[50],
    borderWidth: 2,
    borderColor: colors.primary[600],
  },
  errorText: {
    fontSize: fontSize.footnote,
    color: colors.error.main,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  primaryButton: {
    width: '100%',
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    fontSize: fontSize.headline,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  helpText: {
    marginTop: spacing.lg,
    fontSize: fontSize.footnote,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  helpLink: {
    color: colors.text.link,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  footerText: {
    fontSize: fontSize.caption1,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: colors.text.link,
  },
});
