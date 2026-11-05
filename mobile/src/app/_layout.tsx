import React, { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../store/AuthContext';
import { colors } from '../theme';

// Force RTL layout for the Arabic UI. Requires one app restart to apply;
// it is already enabled at the OS level via app.json supportsRTL.
if (!I18nManager.isRTL) {
  I18nManager.forceRTL(true);
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleAlign: 'center',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(teacher)" options={{ headerShown: false }} />
          <Stack.Screen name="quiz/[id]" options={{ title: 'محرر الاختبار' }} />
          <Stack.Screen name="result/[id]" options={{ title: 'تفاصيل النتيجة' }} />
          <Stack.Screen name="admin/users" options={{ title: 'إدارة المستخدمين' }} />
          <Stack.Screen name="take/[id]" options={{ title: 'الاختبار', headerShown: false }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
