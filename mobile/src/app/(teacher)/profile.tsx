import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuth } from '../../store/AuthContext';
import { updateProfile } from '../../lib/services';
import { colors, typography } from '../../theme';

const PLAN_LABELS: Record<string, string> = {
  '200': 'الباقة الأساسية — مواد نظرية',
  '250': 'الباقة المتقدمة — مواد نظرية',
  '300': 'الباقة الاحترافية — مواد نظرية',
  theory_200: 'الباقة الأساسية — مواد نظرية',
  theory_250: 'الباقة المتقدمة — مواد نظرية',
  theory_300: 'الباقة الاحترافية — مواد نظرية',
  science_250: 'الباقة الأساسية — مواد علمية',
  science_500: 'الباقة المتقدمة — مواد علمية',
  science_750: 'الباقة الاحترافية — مواد علمية',
  trial: 'الباقة التجريبية المجانية',
};

export default function ProfileScreen() {
  const { user, profile, logout, refreshProfile } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [subject, setSubject] = useState(profile?.subject || '');
  const [saving, setSaving] = useState(false);

  const plan = PLAN_LABELS[profile?.subscription_type || profile?.subscriptionPlan || ''] || profile?.subscription_type || '—';
  const status = profile?.subscription_status || profile?.subscriptionStatus || 'trial';
  const statusLabel =
    status === 'active' ? 'نشط' : status === 'admin' ? 'مدير' : status === 'expired' ? 'منتهي' : 'تجريبي';

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim(), subject: subject.trim() });
      await refreshProfile();
      Alert.alert('تم', 'تم حفظ بياناتك.');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل الحفظ.');
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج من حسابك؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  return (
    <Screen>
      <Card>
        <Text style={typography.h2}>{profile?.name || user?.displayName || 'معلم'}</Text>
        <Text style={typography.bodySecondary}>{user?.email}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, status === 'active' || status === 'admin' ? styles.badgeActive : styles.badgeTrial]}>
            <Text style={styles.badgeText}>{statusLabel}</Text>
          </View>
          <Text style={[typography.caption, { flex: 1 }]}>{plan}</Text>
        </View>
        {profile?.tokens_used_today !== undefined ? (
          <Text style={typography.caption}>استهلاك اليوم: {profile.tokens_used_today} توكن</Text>
        ) : null}
      </Card>

      <Card>
        <Text style={[typography.h3, { marginBottom: 10 }]}>البيانات الشخصية</Text>
        <Input label="الاسم" value={name} onChangeText={setName} />
        <Input label="رقم الهاتف" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input label="المادة" value={subject} onChangeText={setSubject} />
        <Button title="حفظ التعديلات" onPress={save} loading={saving} />
      </Card>

      <Button title="تسجيل الخروج" variant="danger" onPress={confirmLogout} style={{ marginTop: 8 }} />
      <Text style={[typography.caption, styles.version]}>مصحح الواجبات الذكي — الإصدار 1.0.0</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  badgeActive: { backgroundColor: colors.successSoft },
  badgeTrial: { backgroundColor: colors.warningSoft },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.text },
  version: { textAlign: 'center', marginTop: 24 },
});
