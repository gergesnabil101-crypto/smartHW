import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuth } from '../../store/AuthContext';
import { colors, typography } from '../../theme';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) return setError('أدخل بريدك الإلكتروني.');
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setDone(true);
    } catch {
      setError('تعذر إرسال رابط الاستعادة. تأكد من البريد وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={[typography.h1, styles.title]}>استعادة كلمة المرور</Text>
      {done ? (
        <Text style={[typography.body, styles.success]}>
          تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك. تحقق من صندوق الوارد (والرسائل غير المرغوبة).
        </Text>
      ) : (
        <>
          <Input
            label="البريد الإلكتروني"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="إرسال رابط الاستعادة" onPress={submit} loading={loading} />
        </>
      )}
      <Link href="/(auth)/login" style={styles.link}>العودة لتسجيل الدخول</Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { textAlign: 'center', marginVertical: 30 },
  error: { color: colors.danger, textAlign: 'right', writingDirection: 'rtl', marginBottom: 10 },
  success: { color: colors.success, textAlign: 'center', marginVertical: 20 },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 24 },
});
