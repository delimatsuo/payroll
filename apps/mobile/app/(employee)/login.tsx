/**
 * Employee Login Screen
 * Apple-style phone OTP authentication flow
 */

import { useState, useRef, useEffect } from 'react';
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
import Animated, {
  FadeInDown,
  FadeOutUp,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';
import { useEmployeeAuth } from '../../src/hooks';

export default function EmployeeLoginScreen() {
  const router = useRouter();
  const { otpStep, isLoading, error, requestOtp, verifyOtp, resendOtp, resetFlow } = useEmployeeAuth();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);

  const otpInputRefs = useRef<Array<TextInput | null>>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

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

  const handleSendOtp = async () => {
    if (phone.length < 10) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await requestOtp(phone);

    if (result.success) {
      setCountdown(60);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6);
      const newOtp = [...otp];
      digits.split('').forEach((d, i) => {
        if (i + index < 6) newOtp[i + index] = d;
      });
      setOtp(newOtp);

      // Focus last filled or next empty
      const lastIndex = Math.min(index + digits.length, 5);
      otpInputRefs.current[lastIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, '');
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (index === 5 && value) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerifyOtp(fullOtp);
      }
    }
  };

  const handleOtpKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (code: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await verifyOtp(phone, code);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(employee)/home' as Href);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await resendOtp();
    if (result.success) {
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetFlow();
    setOtp(['', '', '', '', '', '']);
  };

  const isPhoneValid = phone.length >= 10;
  const isOtpComplete = otp.every(d => d !== '');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          {otpStep === 'otp' && (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color={colors.text.link} />
            </Pressable>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {otpStep === 'phone' ? (
            <Animated.View
              entering={FadeInDown.duration(300)}
              exiting={SlideOutLeft.duration(200)}
              style={styles.stepContainer}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="phone-portrait-outline" size={48} color={colors.primary[600]} />
              </View>

              <Text style={styles.title}>Entrar com celular</Text>
              <Text style={styles.subtitle}>
                Digite seu número para receber um código de verificação pelo WhatsApp
              </Text>

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

              {error && (
                <Animated.Text entering={FadeInDown} style={styles.errorText}>
                  {error}
                </Animated.Text>
              )}

              <Pressable
                onPress={handleSendOtp}
                disabled={!isPhoneValid || isLoading}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (!isPhoneValid || isLoading) && styles.primaryButtonDisabled,
                  pressed && styles.primaryButtonPressed,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <Text style={styles.primaryButtonText}>Enviar código</Text>
                )}
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View
              entering={SlideInRight.duration(300)}
              exiting={FadeOutUp.duration(200)}
              style={styles.stepContainer}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="keypad-outline" size={48} color={colors.primary[600]} />
              </View>

              <Text style={styles.title}>Digite o código</Text>
              <Text style={styles.subtitle}>
                Enviamos um código de 6 dígitos para{'\n'}
                <Text style={styles.phoneHighlight}>{formatPhoneDisplay(phone)}</Text>
              </Text>

              {/* OTP Input */}
              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(el) => { otpInputRefs.current[index] = el; }}
                    style={[
                      styles.otpInput,
                      digit && styles.otpInputFilled,
                    ]}
                    value={digit}
                    onChangeText={(value) => handleOtpChange(index, value)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    autoFocus={index === 0}
                  />
                ))}
              </View>

              {error && (
                <Animated.Text entering={FadeInDown} style={styles.errorText}>
                  {error}
                </Animated.Text>
              )}

              <Pressable
                onPress={() => handleVerifyOtp(otp.join(''))}
                disabled={!isOtpComplete || isLoading}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (!isOtpComplete || isLoading) && styles.primaryButtonDisabled,
                  pressed && styles.primaryButtonPressed,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <Text style={styles.primaryButtonText}>Verificar</Text>
                )}
              </Pressable>

              <Pressable
                onPress={handleResend}
                disabled={countdown > 0}
                style={styles.resendButton}
              >
                <Text style={[
                  styles.resendText,
                  countdown > 0 && styles.resendTextDisabled,
                ]}>
                  {countdown > 0
                    ? `Reenviar código em ${countdown}s`
                    : 'Reenviar código'}
                </Text>
              </Pressable>
            </Animated.View>
          )}
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
  stepContainer: {
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
  phoneHighlight: {
    fontWeight: '600',
    color: colors.text.primary,
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
  otpContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
    fontSize: fontSize.title2,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  otpInputFilled: {
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
  resendButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  resendText: {
    fontSize: fontSize.body,
    color: colors.text.link,
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: colors.text.tertiary,
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
