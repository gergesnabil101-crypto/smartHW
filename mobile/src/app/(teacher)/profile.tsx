import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuth } from '../../store/AuthContext';
import { updateProfile } from '../../lib/services';
import { GRADE_LEVELS } from '../../constants';
import { colors, radius, typography } from '../../theme';

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
  const [grades, setGrades] = useState<string[]>(profile?.grade_level || []);
  const [aiModel, setAiModel] = useState<'flash' | 'pro'>(profile?.preferred_ai_model === 'pro' ? 'pro' : 'flash');
  const [saving, setSaving] = useState(false);

  const plan = PLAN_LABELS[profile?.subscription_type || profile?.subscriptionPlan || ''] || profile?.subscription_type || '—';
  const status = profile?.subscription_status || profile?.subscriptionStatus || 'trial';
  const statusLabel =
    status === 'active' ? 'نشط' : status === 'admin' ? 'مدير' : status === 'expired' ? 'منتهي' : 'تجريبي';

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim(), subject: subject.trim(), grade_level: grades, preferred_ai_model: aiModel });
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
        {profile?.subscription_end_date ? (
          <Text style={typography.caption}>
            ينتهي الاشتراك: {new Date(profile.subscription_end_date).toLocaleDateString('ar-EG')}
          </Text>
        ) : null}
        <Pressable
          onPress={() => {
            const msg = `مرحباً، أريد تفعيل/تجديد اشتراكي في مصحح الواجبات الذكي.\nالاسم: ${profile?.name || ''}\nالبريد: ${user?.email || ''}`;
            Linking.openURL(`https://wa.me/201063124503?text=${encodeURIComponent(msg)}`).catch(() => {});
          }}
          style={styles.renewBtn}
        >
          <Text style={styles.renewText}>💳 تفعيل / تجديد الاشتراك عبر واتساب</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={[typography.h3, { marginBottom: 10 }]}>البيانات الشخصية</Text>
        <Input label="الاسم" value={name} onChangeText={setName} />
        <Input label="رقم الهاتف" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input label="المادة" value={subject} onChangeText={setSubject} />
        <Text style={typography.label}>الصفوف التي تدرّسها</Text>
        <View style={styles.chipsWrap}>
          {GRADE_LEVELS.map((g) => {
            const on = grades.includes(g.value);
            return (
              <Pressable
                key={g.value}
                onPress={() => setGrades((p) => (on ? p.filter((v) => v !== g.value) : [...p, g.value]))}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{g.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={typography.label}>نموذج الذكاء الاصطناعي المفضل</Text>
        <View style={styles.chipsWrap}>
          {([{ v: 'flash' as const, l: 'سريع (Flash)' }, { v: 'pro' as const, l: 'احترافي (Pro)' }]).map((m) => (
            <Pressable key={m.v} onPress={() => setAiModel(m.v)} style={[styles.chip, aiModel === m.v && styles.chipOn]}>
              <Text style={[styles.chipText, aiModel === m.v && styles.chipTextOn]}>{m.l}</Text>
            </Pressable>
          ))}
        </View>
        <Button title="حفظ التعديلات" onPress={save} loading={saving} />
      </Card>

      {(profile?.isAdmin === true || profile?.role === 'admin') ? (
        <Button title="👑 إدارة المستخدمين" variant="secondary" onPress={() => router.push('/admin/users')} style={{ marginTop: 8 }} />
      ) : null}

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
  renewBtn: { marginTop: 12, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12, alignItems: 'center' },
  renewText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  chipsWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textSecondary },
  chipTextOn: { color: '#fff' },
});
