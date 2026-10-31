import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../store/AuthContext';
import { Loading } from '../../components/Feedback';
import { Screen } from '../../components/Screen';
import { colors } from '../../theme';

export default function TeacherLayout() {
  const { initialized, user } = useAuth();

  if (!initialized) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleAlign: 'center',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'اختباراتي',
          tabBarIcon: ({ color, size }) => <Ionicons name="library" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'النتائج',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
      {/* Detail screens live inside the tab layout but are hidden from the bar */}
      <Tabs.Screen name="quiz/[id]" options={{ href: null, title: 'محرر الاختبار' }} />
      <Tabs.Screen name="result/[id]" options={{ href: null, title: 'تفاصيل النتيجة' }} />
    </Tabs>
  );
}
