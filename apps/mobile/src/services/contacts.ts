/**
 * Contacts Service - Pick employees from phone contacts
 * Uses expo-contacts for native contact picker
 */

import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { Alert, Platform } from 'react-native';

export type PickedContact = {
  name: string;
  phone: string;
};

/**
 * Request contacts permission
 * Returns true if granted
 */
export const requestContactsPermission = async (): Promise<boolean> => {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
};

/**
 * Check if contacts permission is granted
 */
export const hasContactsPermission = async (): Promise<boolean> => {
  const { status } = await Contacts.getPermissionsAsync();
  return status === 'granted';
};

/**
 * Format phone number from contact to Brazilian format
 * Handles various formats and extracts just the digits
 */
const formatContactPhone = (phone: string): string => {
  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');

  // If starts with country code 55, remove it
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.substring(2);
  }

  // If starts with 0, remove it (old format)
  if (digits.startsWith('0') && digits.length > 11) {
    digits = digits.substring(1);
  }

  // Brazilian mobile: 11 digits (DDD + 9 + 8 digits)
  // Brazilian landline: 10 digits (DDD + 8 digits)
  // Return only if valid Brazilian number
  if (digits.length === 11 || digits.length === 10) {
    return digits;
  }

  // If 9 digits, might be missing DDD - return as is
  if (digits.length === 9) {
    return digits;
  }

  return digits;
};

/**
 * Format phone for display: (XX) XXXXX-XXXX
 */
export const formatPhoneDisplay = (phone: string): string => {
  const numbers = phone.replace(/\D/g, '');

  if (numbers.length <= 2) {
    return numbers.length ? `(${numbers}` : '';
  }
  if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  }
  if (numbers.length <= 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

/**
 * Open native contact picker and return selected contact
 * Returns null if cancelled or no valid phone found
 */
export const pickContact = async (): Promise<PickedContact | null> => {
  try {
    // Check/request permission
    const hasPermission = await hasContactsPermission();

    if (!hasPermission) {
      const granted = await requestContactsPermission();

      if (!granted) {
        Alert.alert(
          'Permissão necessária',
          'Para adicionar contatos, permita o acesso aos seus contatos nas configurações do app.',
          [{ text: 'OK' }]
        );
        return null;
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Open native contact picker
    const contact = await Contacts.presentContactPickerAsync();

    if (!contact) {
      // User cancelled
      return null;
    }

    // Extract name
    const name = contact.name ||
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
      'Sem nome';

    // Extract phone number (prefer mobile)
    let phone = '';

    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      // Try to find mobile number first
      const mobileNumber = contact.phoneNumbers.find(
        (p) => p.label?.toLowerCase().includes('mobile') ||
               p.label?.toLowerCase().includes('celular') ||
               p.label?.toLowerCase().includes('cell')
      );

      if (mobileNumber?.number) {
        phone = formatContactPhone(mobileNumber.number);
      } else {
        // Fall back to first number
        phone = formatContactPhone(contact.phoneNumbers[0].number || '');
      }
    }

    if (!phone) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Sem número de telefone',
        'Este contato não tem um número de telefone cadastrado.',
        [{ text: 'OK' }]
      );
      return null;
    }

    // Validate phone length
    if (phone.length < 10) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Número inválido',
        'O número de telefone deste contato parece estar incompleto.',
        [{ text: 'OK' }]
      );
      return null;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    return {
      name: name.trim(),
      phone: formatPhoneDisplay(phone),
    };
  } catch (error) {
    console.error('Error picking contact:', error);

    // Check if it's a permission error
    if (error instanceof Error && error.message.includes('permission')) {
      Alert.alert(
        'Permissão necessária',
        'Para adicionar contatos, permita o acesso aos seus contatos nas configurações do app.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Erro',
        'Não foi possível acessar seus contatos. Tente novamente.',
        [{ text: 'OK' }]
      );
    }

    return null;
  }
};

/**
 * Pick multiple contacts (one at a time, with option to continue)
 * Returns array of picked contacts
 */
export const pickMultipleContacts = async (): Promise<PickedContact[]> => {
  const contacts: PickedContact[] = [];

  let keepPicking = true;

  while (keepPicking) {
    const contact = await pickContact();

    if (contact) {
      contacts.push(contact);

      // Ask if they want to add more
      const addMore = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Contato adicionado',
          `${contact.name} foi adicionado. Deseja adicionar mais?`,
          [
            { text: 'Não', onPress: () => resolve(false) },
            { text: 'Sim', onPress: () => resolve(true) },
          ]
        );
      });

      keepPicking = addMore;
    } else {
      // User cancelled or error - stop picking
      keepPicking = false;
    }
  }

  return contacts;
};
