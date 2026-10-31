import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuth } from '../../store/AuthContext';
import { colors, typography } from '../../theme';

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
      setError('الرابط أو الكود غير صالح.');
      return;
    }
    router.push(`/take/${match[1]}`);
  };

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور.');
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
        <Text style={typography.h1}>مصحح الواجبات الذكي</Text>
        <Text style={typography.bodySecondary}>سجل الدخول لمتابعة اختباراتك ونتائج طلابك</Text>
      </View>

      <Input
        label="البريد الإلكتروني"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="teacher@example.com"
      />
      <Input
        label="كلمة المرور"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        placeholder="••••••••"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="تسجيل الدخول" onPress={submit} loading={loading} />

      <View style={styles.links}>
        <Link href="/(auth)/forgot-password" style={styles.link}>نسيت كلمة المرور؟</Link>
        <Link href="/(auth)/register" style={styles.link}>إنشاء حساب معلم جديد</Link>
      </View>

      <View style={styles.studentBox}>
        <Text style={typography.label}>طالب؟ الصق رابط أو كود الاختبار</Text>
        <Input
          value={joinCode}
          onChangeText={setJoinCode}
          placeholder="مثال: https://app.com/?id=abc أو abc"
          autoCapitalize="none"
        />
        <Button title="دخول الاختبار" variant="secondary" onPress={joinQuiz} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 8, marginVertical: 40 },
  error: { color: colors.danger, textAlign: 'right', writingDirection: 'rtl', marginBottom: 10 },
  links: { alignItems: 'center', gap: 14, marginTop: 24 },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  studentBox: { marginTop: 40, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border },
});
