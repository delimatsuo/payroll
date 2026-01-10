import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';
import { api, ChatMessage } from '../../src/services/api';
import {
  ChatBubble,
  QuickReplies,
  ChatInput,
  TypingIndicator,
  InlineStepper,
  InlineTimePicker,
  InlineEmployeeList,
  ContactEmployeeInput,
} from '../../src/components/chat';

export default function OnboardingChatScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepperValue, setStepperValue] = useState(3);

  // Only show interactive elements for the LAST agent message, and only if user hasn't responded yet
  const lastMessage = messages[messages.length - 1];
  const isAwaitingResponse = lastMessage?.role === 'agent';

  // Only show buttons/components if it's the last message AND user hasn't responded
  const activeButtons = isAwaitingResponse && lastMessage?.buttons ? lastMessage.buttons : null;
  const activeComponent = isAwaitingResponse && lastMessage?.component ? lastMessage : null;

  // Start chat session on mount
  useEffect(() => {
    startChat();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const startChat = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await api.startChat();

      if (result.success === false) {
        if (result.error === 'Já existe') {
          // User already has an establishment
          router.replace('/(tabs)');
          return;
        }
        setError(result.message || 'Erro ao iniciar conversa');
        return;
      }

      setSessionId(result.sessionId);
      setMessages(result.messages || []);
    } catch (err) {
      console.error('Error starting chat:', err);
      setError('Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Try to reconnect to existing session
  const reconnectSession = useCallback(async (sid: string) => {
    try {
      const result = await api.getChatSession(sid);
      if (result.success !== false && result.messages) {
        setMessages(result.messages);
        return true;
      }
    } catch {
      console.error('Failed to reconnect session');
    }
    return false;
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!sessionId || sending) return;

    try {
      setSending(true);

      const result = await api.sendChatMessage(sessionId, content);

      if (result.success === false) {
        // Try to reconnect if session not found
        if (result.error === 'Não encontrado') {
          const reconnected = await reconnectSession(sessionId);
          if (!reconnected) {
            Alert.alert('Sessão expirada', 'Vamos reiniciar a conversa.', [
              { text: 'OK', onPress: startChat },
            ]);
          }
          return;
        }
        Alert.alert('Erro', result.message || 'Erro ao enviar mensagem');
        return;
      }

      // Add new messages
      setMessages((prev) => [...prev, ...result.messages]);

      // Check if onboarding is complete
      if (result.isComplete && result.establishmentId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Navigate to home after a short delay
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1500);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Erro de conexão',
        'Não foi possível enviar a mensagem. Verifique sua conexão e tente novamente.',
        [{ text: 'Tentar novamente' }]
      );
    } finally {
      setSending(false);
    }
  }, [sessionId, sending, router, reconnectSession]);

  const sendAction = useCallback(async (action: string, data?: Record<string, unknown>) => {
    if (!sessionId || sending) return;

    try {
      setSending(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await api.sendChatAction(sessionId, action, data);

      if (result.success === false) {
        // Try to reconnect if session not found
        if (result.error === 'Não encontrado') {
          const reconnected = await reconnectSession(sessionId);
          if (!reconnected) {
            Alert.alert('Sessão expirada', 'Vamos reiniciar a conversa.', [
              { text: 'OK', onPress: startChat },
            ]);
          }
          return;
        }
        Alert.alert('Erro', result.message || 'Erro ao processar ação');
        return;
      }

      // Add new messages
      setMessages((prev) => [...prev, ...result.messages]);

      // Check if onboarding is complete
      if (result.isComplete && result.establishmentId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1500);
      }
    } catch (err) {
      console.error('Error sending action:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Erro de conexão',
        'Não foi possível processar. Verifique sua conexão e tente novamente.',
        [{ text: 'OK' }]
      );
    } finally {
      setSending(false);
    }
  }, [sessionId, sending, router, reconnectSession]);

  const handleSkipToManual = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Cadastro manual',
      'Você será redirecionado para preencher os dados manualmente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: async () => {
            await api.skipChat(sessionId || undefined);
            router.push('/(onboarding)/name');
          },
        },
      ]
    );
  };

  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const isLatest = index === messages.length - 1;

    return (
      <ChatBubble
        content={item.content}
        role={item.role}
        isLatest={isLatest}
      />
    );
  }, [messages.length]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <TypingIndicator />
          <Text style={styles.loadingText}>Iniciando conversa...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color={colors.warning.main} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={startChat}
          >
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color={colors.primary[600]} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Assistente RH</Text>
              <Text style={styles.headerSubtitle}>Online</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.skipButton,
              pressed && styles.skipButtonPressed,
            ]}
            onPress={handleSkipToManual}
          >
            <Text style={styles.skipButtonText}>Pular</Text>
          </Pressable>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={sending ? <TypingIndicator /> : null}
        />

        {/* Quick Replies - only for current unanswered message */}
        {activeButtons && !sending && !activeComponent && (
          <QuickReplies
            buttons={activeButtons}
            onSelect={sendAction}
            disabled={sending}
          />
        )}

        {/* Inline Components - only for current unanswered message */}
        {activeComponent && !sending && (
          <>
            {activeComponent.component === 'stepper' && (
              <InlineStepper
                value={stepperValue}
                min={activeComponent.componentData?.min as number || 1}
                max={activeComponent.componentData?.max as number || 20}
                label={activeComponent.componentData?.label as string || 'pessoas'}
                onChange={setStepperValue}
                onSubmit={(value) => sendAction(String(value))}
              />
            )}
            {activeComponent.component === 'time_picker' && (
              <InlineTimePicker
                initialHours={activeComponent.componentData?.current as Record<number, { isOpen: boolean; openTime?: string; closeTime?: string }> | undefined}
                onSubmit={(hours) => sendAction('confirm_hours', { operatingHours: hours })}
              />
            )}
            {activeComponent.component === 'employee_list' && (
              <InlineEmployeeList
                employees={activeComponent.componentData?.employees as { name: string; phone: string; confidence?: number }[] || []}
                onSubmit={(employees) => sendAction('confirm_employees', { employees })}
                onCancel={() => sendMessage('Preciso corrigir a lista')}
              />
            )}
            {activeComponent.component === 'contact_employee_input' && (
              <ContactEmployeeInput
                onSubmit={(employees) => sendAction('confirm_employees', { employees })}
                onSkip={() => sendAction('skip_employees')}
              />
            )}
          </>
        )}

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          placeholder="Digite sua mensagem..."
          disabled={sending}
          loading={sending}
        />
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
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.headline,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: fontSize.caption1,
    color: colors.success.main,
  },
  skipButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  skipButtonPressed: {
    backgroundColor: colors.background.secondary,
  },
  skipButtonText: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
  },
  // Messages
  messagesList: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.body,
    color: colors.text.secondary,
  },
  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSize.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  retryButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  retryButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.inverse,
  },
});
