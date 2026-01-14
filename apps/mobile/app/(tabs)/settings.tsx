import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius, shadows } from '../../src/theme';
import { useEstablishment } from '../../src/hooks/useEstablishment';
import { useAuth } from '../../src/hooks/useAuth';
import { api, ProposedChange } from '../../src/services/api';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposedChanges?: ProposedChange[];
  confirmationMessage?: string;
};

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { establishment, loading, refreshEstablishment } = useEstablishment();
  const [loggingOut, setLoggingOut] = useState(false);

  // AI Chat state
  const [chatVisible, setChatVisible] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingChanges, setPendingChanges] = useState<{
    changes: ProposedChange[];
    confirmationMessage: string;
  } | null>(null);
  const [applyingChanges, setApplyingChanges] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);

  const handleSignOut = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await signOut();
              router.replace('/(auth)/login');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível sair. Tente novamente.');
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  }, [signOut, router]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'restaurant':
        return 'Restaurante';
      case 'store':
        return 'Loja';
      case 'bar':
        return 'Bar';
      case 'other':
        return 'Outro';
      default:
        return type;
    }
  };

  const getTypeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'restaurant':
        return 'restaurant';
      case 'store':
        return 'storefront';
      case 'bar':
        return 'wine';
      case 'other':
        return 'business';
      default:
        return 'business';
    }
  };

  const handleOpenChat = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChatVisible(true);
  }, []);

  const handleCloseChat = useCallback(() => {
    setChatVisible(false);
    setChatInput('');
    setMessages([]);
    setPendingChanges(null);
  }, []);

  const handleSendMessage = useCallback(async () => {
    const messageText = chatInput.trim();
    if (!messageText || chatLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Add user message to timeline immediately
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
    };

    console.log('Adding user message:', userMessage);

    setMessages(prev => {
      console.log('Previous messages:', prev.length, 'Adding:', userMessage.role);
      return [...prev, userMessage];
    });
    setChatInput(''); // Clear input right away
    setChatLoading(true);
    setPendingChanges(null);

    // Scroll to bottom after adding message
    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const result = await api.chatSettings(messageText);

      // Add AI response to timeline
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.message,
        proposedChanges: result.understood ? result.proposedChanges : undefined,
        confirmationMessage: result.understood ? result.confirmationMessage : undefined,
      };

      console.log('Adding AI message:', aiMessage.role);

      setMessages(prev => {
        console.log('Messages before AI:', prev.map(m => m.role));
        return [...prev, aiMessage];
      });

      // Store pending changes if any
      if (result.understood && result.proposedChanges.length > 0) {
        setPendingChanges({
          changes: result.proposedChanges,
          confirmationMessage: result.confirmationMessage,
        });
      }
    } catch (error) {
      console.error('Error sending chat message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, não consegui processar seu pedido. Tente novamente.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
      // Scroll to bottom after response
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatInput, chatLoading]);

  const handleApplyChanges = useCallback(async () => {
    if (!pendingChanges || pendingChanges.changes.length === 0 || applyingChanges) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setApplyingChanges(true);

    try {
      const result = await api.applySettingsChanges(pendingChanges.changes);

      if (result.success) {
        // Add success message to timeline
        const successMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: result.message || 'Mudanças aplicadas com sucesso!',
        };
        setMessages(prev => [...prev, successMessage]);
        setPendingChanges(null);
        refreshEstablishment();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Erro', result.message || 'Não foi possível aplicar as mudanças');
      }
    } catch (error) {
      console.error('Error applying changes:', error);
      Alert.alert('Erro', 'Erro ao aplicar mudanças. Tente novamente.');
    } finally {
      setApplyingChanges(false);
    }
  }, [pendingChanges, applyingChanges, refreshEstablishment]);

  const handleRejectChanges = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingChanges(null);
    // Add cancellation message to timeline
    const cancelMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: 'Ok, as mudanças foram canceladas. O que mais posso ajudar?',
    };
    setMessages(prev => [...prev, cancelMessage]);
  }, []);

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'Não definido';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'number') return String(value);

    // Handle string - might be JSON or plain string
    if (typeof value === 'string') {
      // Try to parse as JSON if it looks like JSON
      if (value.startsWith('{') || value.startsWith('[')) {
        try {
          const parsed = JSON.parse(value);
          return formatValue(parsed); // Recursively format the parsed value
        } catch {
          return value; // Return as-is if not valid JSON
        }
      }
      return value;
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      // Handle operating hours format with isOpen
      if ('isOpen' in obj) {
        if (!obj.isOpen) return 'Fechado';
        if (obj.openTime && obj.closeTime) {
          return `${obj.openTime} - ${obj.closeTime}`;
        }
        return 'Aberto';
      }

      // Handle openTime/closeTime directly (24/7 case)
      if ('openTime' in obj && 'closeTime' in obj) {
        const open = String(obj.openTime);
        const close = String(obj.closeTime);
        // Check for 24 hours case
        if ((open === '00:00' && close === '23:59') || (open === '00:00' && close === '00:00')) {
          return '24 horas';
        }
        return `${open} - ${close}`;
      }

      // Handle status format from LLM
      if ('status' in obj) {
        if (obj.status === 'closed' || obj.status === 'fechado') {
          return 'Fechado';
        }
        if (obj.status === 'open' || obj.status === 'aberto') {
          if (obj.openTime && obj.closeTime) {
            return `${obj.openTime} - ${obj.closeTime}`;
          }
          return 'Aberto';
        }
      }

      // Fallback: show readable format
      const entries = Object.entries(obj);
      if (entries.length === 0) return 'Vazio';
      if (entries.length <= 3) {
        return entries.map(([k, v]) => {
          const key = k === 'openTime' ? 'Abre' : k === 'closeTime' ? 'Fecha' : k;
          return `${key}: ${v}`;
        }).join(', ');
      }
      return `${entries.length} campos`;
    }

    return String(value);
  };

  if (loading || !establishment) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      </SafeAreaView>
    );
  }

  const openDays = Object.entries(establishment.operatingHours || {})
    .filter(([_, hours]) => hours.isOpen)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Large Title Header */}
      <View style={styles.header}>
        <Text style={styles.largeTitle}>Ajustes</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Assistant Card */}
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [
              styles.aiCard,
              pressed && styles.aiCardPressed,
            ]}
            onPress={handleOpenChat}
          >
            <View style={styles.aiIconContainer}>
              <Ionicons name="sparkles" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.aiContent}>
              <Text style={styles.aiTitle}>Assistente IA</Text>
              <Text style={styles.aiDescription}>
                Diga o que quer mudar e eu faço pra você
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.quaternary} />
          </Pressable>
        </View>

        {/* Establishment Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ESTABELECIMENTO</Text>
          <View style={styles.card}>
            <Pressable
              style={({ pressed }) => [
                styles.cardRow,
                pressed && styles.cardRowPressed,
              ]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.primary[100] }]}>
                <Ionicons name={getTypeIcon(establishment.type)} size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardValue}>{establishment.name}</Text>
                <Text style={styles.cardLabel}>{getTypeLabel(establishment.type)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.quaternary} />
            </Pressable>
          </View>
        </View>

        {/* Operating Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HORÁRIOS DE FUNCIONAMENTO</Text>
          <View style={styles.card}>
            {openDays.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Nenhum dia configurado</Text>
              </View>
            ) : (
              openDays.map(([day, hours], index) => (
                <View key={day}>
                  {index > 0 && <View style={styles.separator} />}
                  <View style={styles.hoursRow}>
                    <Text style={styles.hoursDay}>{DAYS[parseInt(day)]}</Text>
                    <Text style={styles.hoursTime}>
                      {hours.openTime} – {hours.closeTime}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Schedule Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONFIGURAÇÕES DE ESCALA</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={[styles.iconContainer, { backgroundColor: colors.info.light }]}>
                <Ionicons name="people" size={20} color={colors.info.main} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Mínimo por turno</Text>
                <Text style={styles.settingDescription}>Funcionários necessários</Text>
              </View>
              <View style={styles.settingBadge}>
                <Text style={styles.settingBadgeText}>
                  {establishment.settings?.minEmployeesPerShift || 2}
                </Text>
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.settingRow}>
              <View style={[styles.iconContainer, { backgroundColor: colors.success.light }]}>
                <Ionicons name="swap-horizontal" size={20} color={colors.success.main} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Trocas de turno</Text>
                <Text style={styles.settingDescription}>Permitir trocas entre funcionários</Text>
              </View>
              <Switch
                value={establishment.settings?.swapsAllowed ?? true}
                disabled
                trackColor={{ false: colors.neutral[200], true: colors.success.light }}
                thumbColor={establishment.settings?.swapsAllowed ? colors.success.main : colors.neutral[400]}
                ios_backgroundColor={colors.neutral[200]}
              />
            </View>

            {establishment.settings?.swapsAllowed && (
              <>
                <View style={styles.separator} />
                <View style={styles.settingRow}>
                  <View style={[styles.iconContainer, { backgroundColor: colors.warning.light }]}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.warning.main} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingLabel}>Aprovação necessária</Text>
                    <Text style={styles.settingDescription}>Trocas precisam de aprovação</Text>
                  </View>
                  <Switch
                    value={establishment.settings?.swapsRequireApproval ?? true}
                    disabled
                    trackColor={{ false: colors.neutral[200], true: colors.warning.light }}
                    thumbColor={establishment.settings?.swapsRequireApproval ? colors.warning.main : colors.neutral[400]}
                    ios_backgroundColor={colors.neutral[200]}
                  />
                </View>

                <View style={styles.separator} />
                <View style={styles.settingRow}>
                  <View style={[styles.iconContainer, { backgroundColor: colors.system.purple + '20' }]}>
                    <Ionicons name="repeat" size={20} color={colors.system.purple} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingLabel}>Máximo de trocas</Text>
                    <Text style={styles.settingDescription}>Por funcionário, por mês</Text>
                  </View>
                  <View style={styles.settingBadge}>
                    <Text style={styles.settingBadgeText}>
                      {establishment.settings?.maxSwapsPerMonth || 4}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTA</Text>
          <View style={styles.card}>
            <View style={styles.accountRow}>
              <View style={[styles.iconContainer, { backgroundColor: colors.system.blue + '20' }]}>
                <Ionicons name="person" size={20} color={colors.system.blue} />
              </View>
              <View style={styles.accountContent}>
                <Text style={styles.accountEmail}>{user?.email || 'Não informado'}</Text>
                <Text style={styles.accountLabel}>Email da conta</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            disabled={loggingOut}
            activeOpacity={0.7}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color={colors.error.main} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color={colors.error.main} />
                <Text style={styles.signOutText}>Sair da conta</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfoSection}>
          <Text style={styles.appName}>Escala Simples</Text>
          <Text style={styles.appVersion}>Versão 1.0.0</Text>
        </View>

        {/* Bottom spacing for tab bar */}
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      {/* AI Chat Modal */}
      <Modal
        visible={chatVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseChat}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleCloseChat} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Assistente IA</Text>
            <View style={styles.modalCloseButton} />
          </View>

          <KeyboardAvoidingView
            style={styles.modalContent}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            {/* Chat Messages */}
            <ScrollView
              ref={chatScrollRef}
              contentContainerStyle={styles.chatScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Welcome message */}
              <View style={styles.aiMessageContainer}>
                <View style={styles.aiAvatar}>
                  <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.aiMessage}>
                  <Text style={styles.aiMessageText}>
                    Olá! Sou seu assistente de ajustes. Você pode me pedir para mudar configurações em linguagem natural.
                  </Text>
                  <Text style={styles.aiMessageHint}>
                    Exemplos:{'\n'}
                    • "Mudar horário de segunda para 10h às 20h"{'\n'}
                    • "Fechar aos domingos"{'\n'}
                    • "Mínimo 3 funcionários por turno"
                  </Text>
                </View>
              </View>

              {/* All messages */}
              {messages.map((msg) => (
                msg.role === 'user' ? (
                  <View key={msg.id} style={styles.userMessageContainer}>
                    <View style={styles.userMessage}>
                      <Text style={styles.userMessageText}>{msg.content}</Text>
                    </View>
                  </View>
                ) : (
                  <View key={msg.id} style={styles.aiMessageContainer}>
                    <View style={styles.aiAvatar}>
                      <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.aiMessage}>
                      <Text style={styles.aiMessageText}>{msg.content}</Text>
                    </View>
                  </View>
                )
              ))}

              {/* Loading indicator */}
              {chatLoading && (
                <View style={styles.aiMessageContainer}>
                  <View style={styles.aiAvatar}>
                    <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                  </View>
                  <View style={styles.aiMessage}>
                    <ActivityIndicator size="small" color={colors.primary[600]} />
                  </View>
                </View>
              )}

              {/* Pending Changes Card */}
              {pendingChanges && pendingChanges.changes.length > 0 && (
                <View style={styles.changesContainer}>
                  <Text style={styles.changesTitle}>Mudanças propostas:</Text>
                  {pendingChanges.changes.map((change, index) => (
                    <View key={index} style={styles.changeCard}>
                      <Text style={styles.changeField}>{change.field}</Text>
                      <Text style={styles.changeDescription}>{change.description}</Text>
                      <View style={styles.changeValuesRow}>
                        <View style={styles.changeValueBox}>
                          <Text style={styles.changeValueLabel}>Antes</Text>
                          <Text style={styles.changeOldValue} numberOfLines={2}>
                            {formatValue(change.currentValue)}
                          </Text>
                        </View>
                        <Ionicons name="arrow-forward" size={20} color={colors.primary[600]} />
                        <View style={styles.changeValueBox}>
                          <Text style={styles.changeValueLabel}>Depois</Text>
                          <Text style={styles.changeNewValue} numberOfLines={2}>
                            {formatValue(change.newValue)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}

                  {pendingChanges.confirmationMessage && (
                    <Text style={styles.confirmationMessage}>{pendingChanges.confirmationMessage}</Text>
                  )}

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={handleRejectChanges}
                      disabled={applyingChanges}
                    >
                      <Text style={styles.rejectButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.approveButton}
                      onPress={handleApplyChanges}
                      disabled={applyingChanges}
                    >
                      {applyingChanges ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.approveButtonText}>Aprovar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Chat Input */}
            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                placeholder="Digite o que quer mudar..."
                placeholderTextColor={colors.text.tertiary}
                value={chatInput}
                onChangeText={setChatInput}
                multiline
                maxLength={500}
                editable={!chatLoading}
                onSubmitEditing={handleSendMessage}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!chatInput.trim() || chatLoading) && styles.sendButtonDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={!chatInput.trim() || chatLoading}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={chatInput.trim() && !chatLoading ? '#FFFFFF' : colors.text.quaternary}
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.grouped,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  largeTitle: {
    fontSize: fontSize.largeTitle,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.md,
  },
  // Sections
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.footnote,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: 0.3,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  // Cards
  card: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  cardRowPressed: {
    backgroundColor: colors.overlay.light,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cardValue: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  cardLabel: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.light,
    marginLeft: spacing.md + 36 + spacing.md, // icon + margins
  },
  // Hours
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  hoursDay: {
    fontSize: fontSize.body,
    color: colors.text.primary,
  },
  hoursTime: {
    fontSize: fontSize.body,
    color: colors.text.secondary,
  },
  emptyState: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.body,
    color: colors.text.tertiary,
  },
  // Settings
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  settingContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  settingLabel: {
    fontSize: fontSize.body,
    fontWeight: '500',
    color: colors.text.primary,
  },
  settingDescription: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  settingBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    minWidth: 36,
    alignItems: 'center',
  },
  settingBadgeText: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.primary[600],
  },
  // Account
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  accountContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  accountEmail: {
    fontSize: fontSize.body,
    fontWeight: '500',
    color: colors.text.primary,
  },
  accountLabel: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
    ...shadows.sm,
  },
  signOutText: {
    fontSize: fontSize.body,
    fontWeight: '500',
    color: colors.error.main,
  },
  // App Info
  appInfoSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  appName: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  appVersion: {
    fontSize: fontSize.footnote,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  // AI Assistant Card
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  aiCardPressed: {
    opacity: 0.7,
  },
  aiIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  aiTitle: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  aiDescription: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: fontSize.headline,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: fontSize.body,
    color: colors.primary[600],
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
  },
  // Chat
  chatContent: {
    flex: 1,
  },
  chatScrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  aiMessageContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  aiMessage: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderTopLeftRadius: borderRadius.xs,
    padding: spacing.md,
  },
  aiMessageText: {
    fontSize: fontSize.body,
    color: colors.text.primary,
    lineHeight: 22,
  },
  aiMessageHint: {
    fontSize: fontSize.footnote,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  userMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.md,
  },
  userMessage: {
    maxWidth: '80%',
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.xs,
    padding: spacing.md,
  },
  userMessageText: {
    fontSize: fontSize.body,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  // Proposed Changes
  changesContainer: {
    marginTop: spacing.md,
  },
  changesTitle: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  changeCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  changeField: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  changeValue: {
    flex: 1,
  },
  changeLabel: {
    fontSize: fontSize.caption1,
    color: colors.text.tertiary,
    marginBottom: spacing.xxs,
  },
  changeOldValue: {
    fontSize: fontSize.footnote,
    color: colors.error.main,
    textDecorationLine: 'line-through',
  },
  changeNewValue: {
    fontSize: fontSize.footnote,
    color: colors.success.main,
    fontWeight: '500',
  },
  changeDescription: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  changeValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  changeValueBox: {
    flex: 1,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  changeValueLabel: {
    fontSize: fontSize.caption2,
    color: colors.text.tertiary,
    marginBottom: spacing.xxs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confirmationMessage: {
    fontSize: fontSize.body,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  rejectButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  approveButton: {
    flex: 1,
    backgroundColor: colors.success.main,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  approveButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Chat Input
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.body,
    color: colors.text.primary,
    maxHeight: 100,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.neutral[200],
  },
});
