import { Stack } from 'expo-router';
import { EmployeeAuthProvider } from '../../src/hooks';

export default function EmployeeLayout() {
  return (
    <EmployeeAuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F2F2F7' },
          animation: 'slide_from_right',
        }}
      />
    </EmployeeAuthProvider>
  );
}
