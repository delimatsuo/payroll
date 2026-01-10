import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius, shadows } from '../../src/theme';
import { useEstablishment } from '../../src/hooks/useEstablishment';
import { useAuth } from '../../src/hooks/useAuth';
import { EstablishmentSwitcher } from '../../src/components/EstablishmentSwitcher';
import { useState, useCallback } from 'react';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    establishment,
    establishments,
    employees,
    refreshEstablishments,
    refreshEmployees,
  } = useEstablishment();
  const [refreshing, setRefreshing] = useState(false);

  const hasMultipleEstablishments = establishments.length > 1;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshEstablishments(), refreshEmployees()]);
    setRefreshing(false);
  }, [refreshEstablishments, refreshEmployees]);

  const handlePressAction = useCallback((route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  }, [router]);

  const getUserName = () => {
    if (user?.displayName) {
      return user.displayName.split(' ')[0];
    }
    if (user?.email) {
      const name = user.email.split('@')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return 'Usuário';
  };

  const activeEmployees = employees.filter((e) => e.status === 'active').length;
  const pendingEmployees = employees.filter((e) => e.status === 'pending').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[600]}
          />
        }
      >
        {/* Header with Large Title */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.greeting}>Olá, {getUserName()}</Text>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          {hasMultipleEstablishments ? (
            <View style={styles.switcherContainer}>
              <EstablishmentSwitcher />
            </View>
          ) : (
            <Text style={styles.establishmentName} numberOfLines={1}>
              {establishment?.name || 'Carregando...'}
            </Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ações Rápidas</Text>
          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.actionCard,
                pressed && styles.actionCardPressed,
              ]}
              onPress={() => handlePressAction('/(tabs)/schedule')}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: colors.primary[100] }]}>
                <Ionicons name="calendar" size={24} color={colors.primary[600]} />
              </View>
              <Text style={styles.actionTitle}>Gerar Escala</Text>
              <Text style={styles.actionSubtitle}>Próxima semana</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actionCard,
                pressed && styles.actionCardPressed,
              ]}
              onPress={() => handlePressAction('/(tabs)/team')}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: colors.success.light }]}>
                <Ionicons name="person-add" size={24} color={colors.success.main} />
              </View>
              <Text style={styles.actionTitle}>Adicionar</Text>
              <Text style={styles.actionSubtitle}>Funcionário</Text>
            </Pressable>
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo</Text>
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{employees.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{activeEmployees}</Text>
              <Text style={styles.statLabel}>Ativos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{pendingEmployees}</Text>
              <Text style={styles.statLabel}>Pendentes</Text>
            </View>
          </View>
        </View>

        {/* Contextual Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {employees.length === 0 ? 'Começar' : 'Próximo Passo'}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.contextCard,
              pressed && styles.contextCardPressed,
            ]}
            onPress={() => handlePressAction(employees.length === 0 ? '/(tabs)/team' : '/(tabs)/schedule')}
          >
            <View style={[
              styles.contextIconContainer,
              { backgroundColor: employees.length === 0 ? colors.info.light : colors.primary[100] }
            ]}>
              <Ionicons
                name={employees.length === 0 ? 'people' : 'sparkles'}
                size={24}
                color={employees.length === 0 ? colors.info.main : colors.primary[600]}
              />
            </View>
            <View style={styles.contextContent}>
              <Text style={styles.contextTitle}>
                {employees.length === 0
                  ? 'Adicione seus funcionários'
                  : 'Gere sua primeira escala'}
              </Text>
              <Text style={styles.contextSubtitle}>
                {employees.length === 0
                  ? 'Cadastre sua equipe para começar'
                  : 'Escala automática com IA'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.quaternary} />
          </Pressable>
        </View>

        {/* Operating Hours Preview */}
        {establishment?.operatingHours && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Funcionamento</Text>
            <View style={styles.hoursCard}>
              {Object.entries(establishment.operatingHours)
                .filter(([_, hours]) => hours.isOpen)
                .slice(0, 4)
                .map(([day, hours], index, arr) => (
                  <View key={day}>
                    <View style={styles.hoursRow}>
                      <Text style={styles.hoursDay}>{getDayName(parseInt(day))}</Text>
                      <Text style={styles.hoursTime}>
                        {hours.openTime} – {hours.closeTime}
                      </Text>
                    </View>
                    {index < arr.length - 1 && <View style={styles.hoursDivider} />}
                  </View>
                ))}
              {Object.values(establishment.operatingHours).filter((h) => h.isOpen).length > 4 && (
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => handlePressAction('/(tabs)/settings')}
                  activeOpacity={0.6}
                >
                  <Text style={styles.viewAllText}>Ver todos</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.text.link} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getDayName(day: number): string {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return days[day] || '';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.grouped,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  // Header
  header: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  greeting: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  establishmentName: {
    fontSize: fontSize.largeTitle,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  switcherContainer: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  // Sections
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.footnote,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  // Action Cards
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  actionCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionTitle: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.text.primary,
  },
  actionSubtitle: {
    fontSize: fontSize.footnote,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  },
  // Stats Card
  statsCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: fontSize.title1,
    fontWeight: '700',
    color: colors.primary[600],
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: fontSize.caption1,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },
  // Context Card
  contextCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  contextCardPressed: {
    opacity: 0.9,
  },
  contextIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  contextTitle: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  contextSubtitle: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  // Hours Card
  hoursCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  hoursDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.light,
    marginLeft: spacing.md,
  },
  hoursDay: {
    fontSize: fontSize.body,
    color: colors.text.primary,
  },
  hoursTime: {
    fontSize: fontSize.body,
    color: colors.text.secondary,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
    gap: spacing.xs,
  },
  viewAllText: {
    fontSize: fontSize.subhead,
    color: colors.text.link,
    fontWeight: '500',
  },
});
