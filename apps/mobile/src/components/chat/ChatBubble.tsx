import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

type ChatBubbleProps = {
  content: string;
  role: 'agent' | 'user';
  isLatest?: boolean;
};

export function ChatBubble({ content, role, isLatest = false }: ChatBubbleProps) {
  const isAgent = role === 'agent';

  return (
    <Animated.View
      entering={isLatest ? FadeInUp.duration(200).springify() : undefined}
      style={[
        styles.container,
        isAgent ? styles.agentContainer : styles.userContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isAgent ? styles.agentBubble : styles.userBubble,
        ]}
      >
        <Text
          style={[
            styles.text,
            isAgent ? styles.agentText : styles.userText,
          ]}
        >
          {content}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  agentContainer: {
    justifyContent: 'flex-start',
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
  },
  agentBubble: {
    backgroundColor: colors.background.secondary,
    borderBottomLeftRadius: borderRadius.xs,
  },
  userBubble: {
    backgroundColor: colors.primary[600],
    borderBottomRightRadius: borderRadius.xs,
  },
  text: {
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.4,
  },
  agentText: {
    color: colors.text.primary,
  },
  userText: {
    color: colors.text.inverse,
  },
});
