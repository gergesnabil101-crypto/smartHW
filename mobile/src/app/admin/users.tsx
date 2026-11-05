import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Loading, EmptyState, ErrorState } from '../../components/Feedback';
import { listAdminUsers, adminUpdateUser } from '../../lib/services';
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
  extra_tokens?: number;
  created_at?: string;
}

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
    if (u.is_suspended || u.subscription_status === 'expired') return 'closed';
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
          const isAdminUser = item.admin === true || item.role === 'admin';
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
                  <Text style={typography.caption} numberOfLines={1}>
                    🪙 اليوم: {Number(item.tokens_used_today || 0).toLocaleString('en')} • الإجمالي: {Number(item.tokens_used || 0).toLocaleString('en')}
                    {item.extra_tokens ? ` • إضافي: ${Number(item.extra_tokens).toLocaleString('en')}` : ''}
                  </Text>
                </View>
                <View style={[styles.badge, suspended ? styles.badgeSuspended : status === 'active' || isAdminUser ? styles.badgeActive : styles.badgeTrial]}>
                  <Text style={styles.badgeText}>{suspended ? 'موقوف' : (STATUS_LABEL[status] || status)}</Text>
                </View>
              </View>
              {!isAdminUser ? (
                <Pressable onPress={() => toggleSuspend(item)} disabled={busyId === (item.uid || item.id)} style={styles.actionBtn}>
                  <Text style={[styles.actionText, suspended && { color: colors.success }]}>
                    {busyId === (item.uid || item.id) ? 'جاري...' : suspended ? '▶️ إعادة تفعيل الحساب' : '⏸ تعليق الحساب'}
                  </Text>
                </Pressable>
              ) : null}
            </Card>
          );
        }}
      />
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
  actionBtn: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, alignItems: 'flex-end' },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.danger },
});
