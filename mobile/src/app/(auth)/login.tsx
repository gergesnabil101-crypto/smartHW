import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useAuth } from '../../store/AuthContext';
import { useLang } from '../../i18n';
import { colors, radius, shadows, typography } from '../../theme';

function friendlyAuthError(code?: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'auth/invalid-email':
      return 'البريد الإلكتروني غير صالح.';
    case 'auth/too-many-requests':
      return 'محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال. تحقق من الإنترنت.';
    default:
      return 'تعذر تسجيل الدخول. حاول مرة أخرى.';
  }
}

export default function LoginScreen() {
  const { signIn, loading } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const joinQuiz = () => {
    const raw = joinCode.trim();
    if (!raw) return;
    // Accept a full URL (…/?id=XYZ) or a bare quiz id
    const match = raw.match(/[?&]id=([A-Za-z0-9_-]+)/) || raw.match(/^([A-Za-z0-9_-]{3,})$/);
    if (!match) {
      setError(t('invalidLink'));
      return;
    }
    router.push(`/take/${match[1]}`);
  };

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError(t('fillCredentials'));
      return;
    }
    try {
      await signIn(email, password);
      router.replace('/(teacher)');
    } catch (e: any) {
      setError(friendlyAuthError(e?.code));
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoEmoji}>📝</Text>
        </View>
        <Text style={typography.h1}>{t('appName')}</Text>
        <Text style={[typography.bodySecondary, { textAlign: 'center' }]}>{t('loginSubtitle')}</Text>
      </View>

      <Card>
        <Input
          label={t('email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="teacher@example.com"
        />
        <Input
          label={t('password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          placeholder="••••••••"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title={t('signIn')} onPress={submit} loading={loading} />
      </Card>

      <View style={styles.links}>
        <Link href="/(auth)/forgot-password" style={styles.link}>{t('forgotPassword')}</Link>
        <Link href="/(auth)/register" style={styles.link}>{t('createAccount')}</Link>
      </View>

      <Card style={{ marginTop: 24 }}>
        <Text style={typography.label}>{t('studentJoinTitle')}</Text>
        <Input
          value={joinCode}
          onChangeText={setJoinCode}
          placeholder="مثال: https://app.com/?id=abc أو abc"
          autoCapitalize="none"
        />
        <Button title={t('joinQuiz')} variant="secondary" onPress={joinQuiz} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 10, marginVertical: 32 },
  logoBadge: { width: 84, height: 84, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6, backgroundColor: colors.primary, ...shadows.elev },
  logoEmoji: { fontSize: 40 },
  error: { color: colors.danger, textAlign: 'right', writingDirection: 'rtl', marginBottom: 10 },
  links: { alignItems: 'center', gap: 14, marginTop: 20 },
  link: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});
