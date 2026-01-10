import { Stack } from 'expo-router';
import { OnboardingProvider } from '../../src/hooks';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FFFFFF' },
          animation: 'slide_from_right',
        }}
      />
    </OnboardingProvider>
  );
}
