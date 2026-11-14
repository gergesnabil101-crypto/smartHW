import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../store/AuthContext';
import { useLang } from '../../i18n';
import { Loading } from '../../components/Feedback';
import { Screen } from '../../components/Screen';
import { colors } from '../../theme';

export default function TeacherLayout() {
  const { initialized, user } = useAuth();
  const { t } = useLang();

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
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.borderSoft, borderTopWidth: 1, elevation: 8, shadowOpacity: 0.06, shadowRadius: 12, height: 62, paddingBottom: 8, paddingTop: 6 },
        headerStyle: { backgroundColor: colors.surface, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
        headerTitleAlign: 'center',
        headerTitleStyle: { fontWeight: '800', fontSize: 17 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabQuizzes'),
          tabBarIcon: ({ color, size }: any) => <Ionicons name="library" color={color} size={size + 2} />,
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: t('tabStudents'),
          tabBarIcon: ({ color, size }: any) => <Ionicons name="people" color={color} size={size + 2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabProfile'),
          tabBarIcon: ({ color, size }: any) => <Ionicons name="person" color={color} size={size + 2} />,
        }}
      />
    </Tabs>
  );
}
