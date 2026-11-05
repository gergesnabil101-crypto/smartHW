import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Loading, EmptyState, ErrorState } from '../../components/Feedback';
import { listAdminUsers, adminUpdateUser, adminDeleteUser } from '../../lib/services';
import { useAuth } from '../../store/AuthContext';
import { colors, radius, typography } from '../../theme';

interface AdminUser {
  id?: string;
  uid?: string;
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  role?: string;
  admin?: boolean;
  subscription_type?: string;
  subscription_status?: string;
  is_suspended?: boolean;
  tokens_used?: number;
  tokens_used_today?: number;
  tokens_used_total?: number;
  extra_tokens?: number;
  remaining_tokens?: number;
  custom_tokens_millions?: number;
  subscription_end_date?: string;
  created_at?: string;
}

const DAY_MS = 86400000;
const endDateOf = (u: AdminUser): Date | null => {
  const d = u.subscription_end_date ? new Date(u.subscription_end_date) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};
const daysLeft = (u: AdminUser): number | null => {
  const end = endDateOf(u);
  if (!end) return null;
  return Math.ceil((end.getTime() - Date.now()) / DAY_MS);
};
const isExpired = (u: AdminUser): boolean => {
  const days = daysLeft(u);
  return u.subscription_status === 'expired' || (days !== null && days < 0);
};

const STATUS_LABEL: Record<string, string> = {
  active: 'نشط', trial: 'تجريبي', expired: 'منتهي', admin: 'مدير', pending: 'معلق',
};

export default function AdminUsersScreen() {
  const { user, profile, initialized } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'trial' | 'active' | 'closed'>('active');
  const [tokenTarget, setTokenTarget] = useState<AdminUser | null>(null);
  const [tokenAmount, setTokenAmount] = useState('');

  const isAdmin = profile?.isAdmin === true || profile?.role === 'admin';

  const load = useCallback(async () => {
    setError('');
    try {
      setUsers(await listAdminUsers());
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل المستخدمين.');
      setUsers([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categoryOf = (u: AdminUser): 'trial' | 'active' | 'closed' => {
    if (u.is_suspended || isExpired(u)) return 'closed';
    const s = (u.subscription_status || '').toLowerCase();
    if (s === 'active' || s === 'admin' || u.admin === true || u.role === 'admin') return 'active';
    return 'trial'; // trial / pending / empty
  };

  const counts = useMemo(() => {
    const c = { trial: 0, active: 0, closed: 0 };
    (users || []).forEach((u) => { c[categoryOf(u)]++; });
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = (users || []).filter((u) => categoryOf(u) === tab);
    if (!q) return list;
    return list.filter((u) => `${u.name} ${u.email} ${u.phone || ''} ${u.subject || ''}`.toLowerCase().includes(q));
  }, [users, search, tab]);

  const toggleSuspend = async (u: AdminUser) => {
    const uid = u.uid || u.id;
    if (!uid) return;
    const next = !u.is_suspended;
    setBusyId(uid);
    try {
      await adminUpdateUser(uid, u.email, { is_suspended: next });
      setUsers((p) => p?.map((x) => ((x.uid || x.id) === uid ? { ...x, is_suspended: next } : x)) || []);
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل تحديث الحساب.');
    } finally {
      setBusyId(null);
    }
  };

  const resetAccount = (u: AdminUser) => {
    const uid = u.uid || u.id;
    if (!uid) return;
    Alert.alert('تصفير الحساب', `تصفير استهلاك التوكنز لـ ${u.name || u.email}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تصفير', onPress: async () => {
          setBusyId(uid);
          try {
            await adminUpdateUser(uid, u.email, { tokens_used: 0, tokens_used_today: 0, tokens_used_total: 0 });
            setUsers((p) => p?.map((x) => ((x.uid || x.id) === uid ? { ...x, tokens_used: 0, tokens_used_today: 0, tokens_used_total: 0 } : x)) || []);
          } catch (e: any) {
            Alert.alert('خطأ', e?.message || 'فشل تصفير الحساب.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const addExtraTokens = async () => {
    const u = tokenTarget;
    const uid = u?.uid || u?.id;
    const amount = Math.floor(Number(tokenAmount));
    if (!u || !uid) return;
    if (!amount || amount <= 0) return Alert.alert('قيمة غير صحيحة', 'أدخل عدد توكنز صحيح أكبر من صفر.');
    setBusyId(uid);
    try {
      const next = (Number(u.extra_tokens) || 0) + amount;
      await adminUpdateUser(uid, u.email, { extra_tokens: next });
      setUsers((p) => p?.map((x) => ((x.uid || x.id) === uid ? { ...x, extra_tokens: next } : x)) || []);
      setTokenTarget(null);
      setTokenAmount('');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل إضافة التوكنز.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteAccount = (u: AdminUser) => {
    const uid = u.uid || u.id;
    if (!uid) return;
    Alert.alert(
      '⚠️ حذف الحساب نهائياً',
      `سيتم حذف حساب ${u.name || u.email} وجميع بياناته (اختبارات، نتائج، طلاب) بشكل نهائي ولا يمكن التراجع. متابعة؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف نهائي', style: 'destructive', onPress: async () => {
            setBusyId(uid);
            try {
              await adminDeleteUser(uid, u.email, u.name);
              setUsers((p) => p?.filter((x) => (x.uid || x.id) !== uid) || []);
            } catch (e: any) {
              Alert.alert('خطأ', e?.message || 'فشل حذف الحساب.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  if (initialized && !user) return <Redirect href="/(auth)/login" />;
  if (initialized && user && !isAdmin && users !== null && !error) {
    return (
      <Screen>
        <EmptyState title="غير مصرح" hint="هذه الصفحة مخصصة لمديري المنصة فقط." />
      </Screen>
    );
  }
  if (users === null && !error) return <Screen><Loading text="جاري تحميل المستخدمين..." /></Screen>;

  return (
    <Screen scroll={false}>
      <View style={styles.searchWrap}>
        <Input placeholder="ابحث بالاسم أو البريد أو الهاتف..." value={search} onChangeText={setSearch} />
        <View style={styles.tabsRow}>
          {([
            { key: 'trial' as const, label: `تجريبي (${counts.trial})` },
            { key: 'active' as const, label: `مفعّل (${counts.active})` },
            { key: 'closed' as const, label: `مغلق (${counts.closed})` },
          ]).map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabChip, tab === t.key && styles.tabChipOn]}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={typography.caption}>{filtered.length} مستخدم</Text>
      </View>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      <FlatList
        data={filtered}
        keyExtractor={(u) => String(u.uid || u.id || u.email)}
        refreshing={refreshing}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="لا يوجد مستخدمون" />}
        renderItem={({ item }) => {
          const status = item.subscription_status || 'trial';
          const suspended = !!item.is_suspended;
          const expired = isExpired(item);
          const days = daysLeft(item);
          const isAdminUser = item.admin === true || item.role === 'admin';
          const uid = item.uid || item.id;
          const busy = busyId === uid;
          return (
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3} numberOfLines={1}>
                    {item.name || item.email || '—'}{isAdminUser ? ' 👑' : ''}
                  </Text>
                  <Text style={typography.caption} numberOfLines={1}>{item.email}</Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {item.subject || '—'}{item.subscription_type ? ` • ${item.subscription_type}` : ''}
                  </Text>
                  {days !== null ? (
                    <Text style={[typography.caption, { color: expired ? colors.danger : days <= 7 ? colors.warning : colors.textSecondary }]} numberOfLines={1}>
                      ⏳ {expired ? 'انتهى الاشتراك' : `متبقي ${days} يوم`} — {endDateOf(item)!.toLocaleDateString('ar-EG')}
                    </Text>
                  ) : null}
                  <Text style={typography.caption} numberOfLines={1}>
                    🪙 اليوم: {Number(item.tokens_used_today || 0).toLocaleString('en')} • الإجمالي: {Number(item.tokens_used || 0).toLocaleString('en')}
                  </Text>
                  {!expired && (item.extra_tokens || item.remaining_tokens !== undefined) ? (
                    <Text style={typography.caption} numberOfLines={1}>
                      💎 {item.remaining_tokens !== undefined ? `المتبقي: ${Number(item.remaining_tokens).toLocaleString('en')}` : ''}
                      {item.extra_tokens ? `${item.remaining_tokens !== undefined ? ' • ' : ''}إضافي: ${Number(item.extra_tokens).toLocaleString('en')}` : ''}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.badge, suspended || expired ? styles.badgeSuspended : status === 'active' || isAdminUser ? styles.badgeActive : styles.badgeTrial]}>
                  <Text style={styles.badgeText}>{suspended ? 'موقوف' : expired ? 'منتهي' : (STATUS_LABEL[status] || status)}</Text>
                </View>
              </View>
              {!isAdminUser ? (
                <View style={styles.actionsRow}>
                  <Pressable onPress={() => toggleSuspend(item)} disabled={busy} style={styles.actionChip}>
                    <Text style={[styles.actionText, { color: suspended ? colors.success : colors.warning }]}>
                      {suspended ? '▶️ تفعيل' : '⏸ تعليق'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => resetAccount(item)} disabled={busy} style={styles.actionChip}>
                    <Text style={[styles.actionText, { color: colors.primary }]}>🔄 تصفير</Text>
                  </Pressable>
                  <Pressable onPress={() => { setTokenTarget(item); setTokenAmount(''); }} disabled={busy} style={styles.actionChip}>
                    <Text style={[styles.actionText, { color: colors.primary }]}>➕ توكنز</Text>
                  </Pressable>
                  <Pressable onPress={() => deleteAccount(item)} disabled={busy} style={styles.actionChip}>
                    <Text style={[styles.actionText, { color: colors.danger }]}>🗑 حذف</Text>
                  </Pressable>
                </View>
              ) : null}
            </Card>
          );
        }}
      />
      <Modal visible={!!tokenTarget} transparent animationType="fade" onRequestClose={() => setTokenTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={typography.h3}>➕ إضافة توكنز استثنائية</Text>
            <Text style={typography.caption}>
              {tokenTarget?.name || tokenTarget?.email} — الرصيد الإضافي الحالي: {Number(tokenTarget?.extra_tokens || 0).toLocaleString('en')}
            </Text>
            <Input placeholder="عدد التوكنز (مثال: 500000)" value={tokenAmount} onChangeText={setTokenAmount} keyboardType="numeric" />
            <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
              <Button title="إضافة" onPress={addExtraTokens} loading={busyId === (tokenTarget?.uid || tokenTarget?.id)} />
              <Button title="إلغاء" variant="secondary" onPress={() => setTokenTarget(null)} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { padding: 16, paddingBottom: 4 },
  tabsRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 8, marginBottom: 4 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tabChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tabTextOn: { color: '#fff' },
  list: { padding: 16, flexGrow: 1 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  badge: { borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 5 },
  badgeActive: { backgroundColor: colors.successSoft },
  badgeTrial: { backgroundColor: colors.warningSoft },
  badgeSuspended: { backgroundColor: colors.dangerSoft },
  badgeText: { fontWeight: '800', fontSize: 12, color: colors.text },
  actionsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  actionChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, gap: 12 },
});
