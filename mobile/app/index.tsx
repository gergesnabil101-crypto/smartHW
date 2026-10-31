import React, { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/store/AuthContext';
import { Loading } from '../src/components/Feedback';
import { Screen } from '../src/components/Screen';

/** Entry point: route to quiz-taking (deep link), teacher area, or login. */
export default function Index() {
  const { initialized, user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; q?: string }>();
  const quizId = params.id || params.q;

  if (!initialized) {
    return (
      <Screen>
        <Loading text="جاري تهيئة التطبيق..." />
      </Screen>
    );
  }

  if (quizId) return <Redirect href={`/take/${quizId}`} />;
  if (user) return <Redirect href="/(teacher)" />;
  return <Redirect href="/(auth)/login" />;
}
