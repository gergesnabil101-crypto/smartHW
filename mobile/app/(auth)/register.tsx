import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/store/AuthContext';
import { colors, typography } from '../../src/theme';

function validate(email: string, password: string, name: string): string {
  if (!name.trim()) return 'أدخل الاسم الكامل.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'أدخل بريداً إلكترونياً صالحاً.';
  if (password.length < 8) return 'كلمة المرور يجب ألا تقل عن 8 أحرف.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    return 'كلمة المرور يجب أن تحتوي على حروف وأرقام.';
  return '';
}

export default function RegisterScreen() {
  const { register, loading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    const v = validate(email, password, name);
    if (v) return setError(v);
    if (password !== confirm) return setError('تأكيد كلمة المرور غير متطابق.');
    setError('');
    try {
      await register(name, email, password, { phone: phone.trim(), subject: subject.trim() });
      router.replace('/(teacher)');
    } catch (e: any) {
      setError(
        e?.code === 'auth/email-already-in-use'
          ? 'هذا البريد مسجل بالفعل. سجل الدخول بدلاً من ذلك.'
          : 'تعذر إنشاء الحساب. حاول مرة أخرى.'
      );
    }
  };

  return (
    <Screen>
      <Text style={[typography.h1, styles.title]}>إنشاء حساب معلم</Text>

      <Input label="الاسم الكامل" value={name} onChangeText={setName} placeholder="مستر أحمد محمد" />
      <Input label="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Input label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry placeholder="8 أحرف على الأقل (حروف وأرقام)" />
      <Input label="تأكيد كلمة المرور" value={confirm} onChangeText={setConfirm} secureTextEntry />
      <Input label="رقم الهاتف (اختياري)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Input label="المادة (اختياري)" value={subject} onChangeText={setSubject} placeholder="مثال: رياضيات" />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="إنشاء الحساب" onPress={submit} loading={loading} />

      <Link href="/(auth)/login" style={styles.link}>لديك حساب بالفعل؟ سجل الدخول</Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { textAlign: 'center', marginVertical: 30 },
  error: { color: colors.danger, textAlign: 'right', writingDirection: 'rtl', marginBottom: 10 },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 24 },
});
