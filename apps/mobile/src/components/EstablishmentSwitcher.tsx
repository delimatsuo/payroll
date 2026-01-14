/**
 * EstablishmentSwitcher - Apple-style establishment selector
 * Appears in the header for users with multiple establishments
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, fontSize, borderRadius, shadows } from '../theme';
import { useEstablishment } from '../hooks/useEstablishment';
import { Establishment } from '../services/api';

const ESTABLISHMENT_ICONS: Record<string, string> = {
  restaurant: 'restaurant',
  bar: 'beer',
  store: 'storefront',
  other: 'business',
};

export function EstablishmentSwitcher() {
  const {
    establishments,
    establishment,
    activeEstablishmentId,
    switchEstablishment,
  } = useEstablishment();
  const [isOpen, setIsOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleOpen = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback(async (est: Establishment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await switchEstablishment(est.id);
    setIsOpen(false);
  }, [switchEstablishment]);

  const handleAddNew = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOpen(false);
    router.push('/(onboarding)/team');
  }, [router]);

  // Don't show if user has no establishments or only one
  if (!establishment || establishments.length <= 1) {
    return null;
  }

  return (
    <>
      {/* Trigger Button */}
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.trigger,
          pressed && styles.triggerPressed,
        ]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.triggerContent}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={ESTABLISHMENT_ICONS[establishment.type] as any || 'business'}
              size={16}
              color={colors.primary[600]}
            />
          </View>
          <Text style={styles.triggerText} numberOfLines={1}>
            {establishment.name}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={colors.text.tertiary}
          />
        </View>
      </Pressable>

      {/* Selection Sheet */}
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={handleClose}
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.overlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

          <Animated.View
            entering={SlideInDown.springify().damping(20).stiffness(200)}
            exiting={SlideOutDown.duration(200)}
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            {Platform.OS === 'ios' && (
              <BlurView
                tint="light"
                intensity={100}
                style={StyleSheet.absoluteFill}
              />
            )}

            {/* Handle */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Seus Estabelecimentos</Text>
              <Pressable
                onPress={handleClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <View style={styles.closeButton}>
                  <Ionicons name="close" size={16} color={colors.text.secondary} />
                </View>
              </Pressable>
            </View>

            {/* Establishment List */}
            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
              bounces={establishments.length > 4}
            >
              {establishments.map((est, index) => {
                const isSelected = est.id === activeEstablishmentId;
                const isLast = index === establishments.length - 1;

                return (
                  <Pressable
                    key={est.id}
                    onPress={() => handleSelect(est)}
                    style={({ pressed }) => [
                      styles.item,
                      pressed && styles.itemPressed,
                      !isLast && styles.itemBorder,
                    ]}
                  >
                    <View style={[
                      styles.itemIcon,
                      isSelected && styles.itemIconSelected,
                    ]}>
                      <Ionicons
                        name={ESTABLISHMENT_ICONS[est.type] as any || 'business'}
                        size={20}
                        color={isSelected ? colors.primary[600] : colors.text.tertiary}
                      />
                    </View>

                    <View style={styles.itemContent}>
                      <Text style={[
                        styles.itemName,
                        isSelected && styles.itemNameSelected,
                      ]}>
                        {est.name}
                      </Text>
                      <Text style={styles.itemType}>
                        {getTypeLabel(est.type)}
                      </Text>
                    </View>

                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={colors.primary[600]}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Add New Button */}
            <View style={styles.footer}>
              <Pressable
                onPress={handleAddNew}
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.addButtonPressed,
                ]}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={22}
                  color={colors.primary[600]}
                />
                <Text style={styles.addButtonText}>
                  Adicionar novo estabelecimento
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    restaurant: 'Restaurante',
    bar: 'Bar',
    store: 'Loja',
    other: 'Outro',
  };
  return labels[type] || 'Estabelecimento';
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  // Trigger Button
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
  },
  triggerPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: SCREEN_WIDTH * 0.5,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.text.primary,
    flexShrink: 1,
  },

  // Overlay & Sheet
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.background.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    overflow: 'hidden',
    maxHeight: '70%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[300],
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  title: {
    fontSize: fontSize.headline,
    fontWeight: '600',
    color: colors.text.primary,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  list: {
    paddingHorizontal: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  itemPressed: {
    backgroundColor: colors.overlay.light,
    borderRadius: borderRadius.md,
  },
  itemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconSelected: {
    backgroundColor: colors.primary[50],
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: fontSize.body,
    fontWeight: '500',
    color: colors.text.primary,
  },
  itemNameSelected: {
    fontWeight: '600',
    color: colors.primary[600],
  },
  itemType: {
    fontSize: fontSize.footnote,
    color: colors.text.tertiary,
    marginTop: 2,
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  addButtonPressed: {
    opacity: 0.7,
  },
  addButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.primary[600],
  },
});
