/**
 * Share Service - Native sharing for invitations
 * Uses the phone's share functionality instead of WhatsApp API
 */

import { Share, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

const APP_URL = 'https://escala-simples.com';

/**
 * Share an employee invitation via the native share sheet
 * User can choose to share via WhatsApp, SMS, Email, or any installed app
 */
export const shareEmployeeInvite = async (
  employeeName: string,
  establishmentName: string,
  inviteToken: string
): Promise<{ success: boolean; action?: string }> => {
  const inviteUrl = `${APP_URL}/invite/${inviteToken}`;

  const message = `Olá ${employeeName}! 👋

Você foi convidado(a) para fazer parte da equipe do ${establishmentName} no Escala Simples.

Para informar seus horários disponíveis, acesse:
${inviteUrl}

Este link é pessoal e intransferível.`;

  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await Share.share(
      {
        message,
        title: `Convite - ${establishmentName}`,
        // On iOS, url is shown separately from message
        ...(Platform.OS === 'ios' ? { url: inviteUrl } : {}),
      },
      {
        // Android: show dialog title
        dialogTitle: `Convidar ${employeeName}`,
        // iOS: exclude some activity types if needed
        excludedActivityTypes: [],
      }
    );

    if (result.action === Share.sharedAction) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return { success: true, action: 'shared' };
    } else if (result.action === Share.dismissedAction) {
      // User cancelled
      return { success: false, action: 'dismissed' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sharing invite:', error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    return { success: false };
  }
};

/**
 * Copy invite link to clipboard
 * Alternative to sharing - manager can paste anywhere
 */
export const copyInviteLink = async (
  inviteToken: string
): Promise<{ success: boolean }> => {
  const inviteUrl = `${APP_URL}/invite/${inviteToken}`;

  try {
    await Clipboard.setStringAsync(inviteUrl);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return { success: true };
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    return { success: false };
  }
};

/**
 * Share PIN code with employee (via share sheet or copy)
 * Used after employee is created to share their login PIN
 */
export const shareEmployeePIN = async (
  employeeName: string,
  pin: string
): Promise<{ success: boolean; action?: string }> => {
  const message = `Olá ${employeeName}!

Seu PIN de acesso ao Escala Simples é: ${pin}

Use este código junto com seu número de celular para entrar no app.

Não compartilhe este PIN com outras pessoas.`;

  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await Share.share({
      message,
      title: 'PIN de Acesso - Escala Simples',
    });

    if (result.action === Share.sharedAction) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return { success: true, action: 'shared' };
    }

    return { success: false, action: 'dismissed' };
  } catch (error) {
    console.error('Error sharing PIN:', error);
    return { success: false };
  }
};

/**
 * Copy PIN to clipboard
 */
export const copyPIN = async (pin: string): Promise<{ success: boolean }> => {
  try {
    await Clipboard.setStringAsync(pin);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return { success: true };
  } catch (error) {
    console.error('Error copying PIN:', error);
    return { success: false };
  }
};
