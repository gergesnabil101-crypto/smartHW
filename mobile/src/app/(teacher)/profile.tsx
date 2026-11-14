import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuth, isAdminUser } from '../../store/AuthContext';
import { useLang, type Lang } from '../../i18n';
import { updateProfile, deleteMyAccount } from '../../lib/services';
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
  const { lang, setLang, t } = useLang();
  const router = useRouter();
  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [subject, setSubject] = useState(profile?.subject || '');
  const [grades, setGrades] = useState<string[]>(profile?.grade_level || []);
  const [aiModel, setAiModel] = useState<'flash' | 'pro'>(profile?.preferred_ai_model === 'pro' ? 'pro' : 'flash');
  const [saving, setSaving] = useState(false);

  const admin = isAdminUser(profile as any, user?.email);
  const plan = admin ? t('platformAdmin') : (PLAN_LABELS[profile?.subscription_type || profile?.subscriptionPlan || ''] || profile?.subscription_type || '—');
  const status = admin ? 'admin' : (profile?.subscription_status || profile?.subscriptionStatus || 'trial');
  const statusLabel =
    status === 'admin' ? t('statusAdmin') : status === 'active' ? t('statusActive') : status === 'expired' ? t('statusExpired') : t('statusTrial');
  const today = new Date().toISOString().split('T')[0];
  const tokensToday = profile?.last_token_reset_date === today ? Number(profile?.tokens_used_today) || 0 : 0;

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim(), subject: subject.trim(), grade_level: grades, preferred_ai_model: aiModel });
      await refreshProfile();
      Alert.alert(t('done'), t('saved'));
    } catch (e: any) {
      Alert.alert(t('error'), e?.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert(t('logoutTitle'), t('logoutConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logoutBtn'), style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  // In-app account deletion — required by Google Play policy for apps with accounts.
  const confirmDeleteAccount = () => {
    Alert.alert(t('deleteAccountTitle'), t('deleteAccountMsg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteAccountBtn'),
        style: 'destructive',
        onPress: () => Alert.alert(t('deleteAccountTitle'), t('deleteAccountSure'), [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('deleteAccountBtn'),
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteMyAccount(user!.uid);
                await logout();
                router.replace('/(auth)/login');
              } catch (e: any) {
                Alert.alert(t('error'), e?.message || t('deleteAccountFail'));
              }
            },
          },
        ]),
      },
    ]);
  };

  return (
    <Screen>
      <Card>
        <Text style={typography.h2}>{profile?.name || user?.displayName || 'معلم'}</Text>
        <Text style={typography.bodySecondary}>{user?.email}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, status === 'admin' ? styles.badgeAdmin : status === 'active' ? styles.badgeActive : styles.badgeTrial]}>
            <Text style={[styles.badgeText, status === 'admin' && { color: '#fff' }]}>{status === 'admin' ? '👑 ' : ''}{statusLabel}</Text>
          </View>
          <Text style={[typography.caption, { flex: 1 }]}>{plan}</Text>
        </View>
        <Text style={typography.caption}>{t('dailyUsage')}: {tokensToday.toLocaleString('en')} {t('tokenUnit')}</Text>
        {profile?.subscription_end_date ? (
          <Text style={typography.caption}>
            {t('subEnds')}: {new Date(profile.subscription_end_date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
          </Text>
        ) : null}
        <Pressable onPress={() => router.push('/subscription')} style={styles.renewBtn}>
          <Text style={styles.renewText}>{t('plansLink')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/instructions')} style={styles.renewBtn}>
          <Text style={styles.renewText}>{t('instructionsLink')}</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={[typography.h3, { marginBottom: 10 }]}>{t('personalData')}</Text>
        <Input label={t('name')} value={name} onChangeText={setName} />
        <Input label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input label={t('subject')} value={subject} onChangeText={setSubject} />
        <Text style={typography.label}>{t('taughtGrades')}</Text>
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
        <Text style={typography.label}>{t('preferredModel')}</Text>
        <View style={styles.chipsWrap}>
          {([{ v: 'flash' as const, l: t('modelFlash') }, { v: 'pro' as const, l: t('modelPro') }]).map((m) => (
            <Pressable key={m.v} onPress={() => setAiModel(m.v)} style={[styles.chip, aiModel === m.v && styles.chipOn]}>
              <Text style={[styles.chipText, aiModel === m.v && styles.chipTextOn]}>{m.l}</Text>
            </Pressable>
          ))}
        </View>
        <Button title={t('saveChanges')} onPress={save} loading={saving} />
      </Card>

      <Card>
        <Text style={[typography.h3, { marginBottom: 10 }]}>🌐 {t('language')}</Text>
        <View style={styles.chipsWrap}>
          {([{ v: 'ar' as Lang, l: 'العربية' }, { v: 'en' as Lang, l: 'English' }]).map((l) => (
            <Pressable key={l.v} onPress={() => setLang(l.v)} style={[styles.chip, lang === l.v && styles.chipOn]}>
              <Text style={[styles.chipText, lang === l.v && styles.chipTextOn]}>{l.l}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {admin ? (
        <>
          <Button title={t('adminUsers')} variant="secondary" onPress={() => router.push('/admin/users')} style={{ marginTop: 8 }} />
          <Button title={t('adminRequests')} variant="secondary" onPress={() => router.push('/admin/requests')} style={{ marginTop: 8 }} />
        </>
      ) : null}

      <Button title={t('logout')} variant="danger" onPress={confirmLogout} style={{ marginTop: 8 }} />
      <Pressable onPress={confirmDeleteAccount} style={styles.deleteAccount}>
        <Text style={styles.deleteAccountText}>{t('deleteAccount')}</Text>
      </Pressable>
      <Text style={[typography.caption, styles.version]}>مصحح الواجبات الذكي — الإصدار 1.0.0</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  badgeActive: { backgroundColor: colors.successSoft },
  badgeTrial: { backgroundColor: colors.warningSoft },
  badgeAdmin: { backgroundColor: colors.primary },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.text },
  version: { textAlign: 'center', marginTop: 24 },
  deleteAccount: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  deleteAccountText: { color: colors.danger, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  renewBtn: { marginTop: 12, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12, alignItems: 'center' },
  renewText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  chipsWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textSecondary },
  chipTextOn: { color: '#fff' },
});
