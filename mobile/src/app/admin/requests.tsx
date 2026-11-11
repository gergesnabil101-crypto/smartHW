import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Loading, EmptyState, ErrorState } from '../../components/Feedback';
import { adminApproveSubscription, adminDeleteSubscriptionRequest } from '../../lib/services';
import { db } from '../../lib/firebase';
import { PLANS } from '../../lib/plans';
import { useAuth, isAdminUser } from '../../store/AuthContext';
import { colors, radius, typography } from '../../theme';

interface SubRequest {
  id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  user_subject?: string;
  plan?: string;
  billing_cycle?: string;
  custom_details?: string;
  screenshot_data?: string;
  status?: string;
  created_at?: string;
}

function planLabel(req: SubRequest): string {
  const plan = String(req.plan || '');
  if (plan === 'upgrade_to_pro') {
    let extra = '';
    try {
      const d = req.custom_details ? JSON.parse(req.custom_details) : null;
      if (d?.amount_egp != null) extra = ` — فارق ${d.amount_egp} ج.م`;
    } catch { /* custom_details is opaque */ }
    return `👑 ترقية إلى برو${extra}`;
  }
  if (plan.startsWith('extra_')) return `➕ شحن توكنز إضافية (${plan})`;
  const found = PLANS.find((p) => p.id === plan);
  return found ? found.name : plan || 'باقة غير معروفة';
}

export default function AdminRequestsScreen() {
  const { initialized, user, profile } = useAuth();
  const isAdmin = isAdminUser(profile as any, user?.email);
  const [requests, setRequests] = useState<SubRequest[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [receiptView, setReceiptView] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const snap = await getDocs(query(collection(db, 'subscription_requests'), where('status', '==', 'pending')));
      const list: SubRequest[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      setRequests(list);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل طلبات الاشتراك.');
      setRequests([]);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const approve = async (r: SubRequest) => {
    Alert.alert('تفعيل الاشتراك', `تفعيل «${planLabel(r)}» للمستخدم ${r.user_name || r.user_email}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تفعيل', onPress: async () => {
          setBusyId(r.id);
          try {
            await adminApproveSubscription(r.id);
            setRequests((s) => (s || []).filter((x) => x.id !== r.id));
            Alert.alert('تم ✅', 'تم تفعيل الاشتراك/الطلب بنجاح.');
          } catch (e: any) {
            Alert.alert('فشل التفعيل', e?.message || 'حاول مرة أخرى.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const reject = async (r: SubRequest) => {
    Alert.alert('رفض الطلب', `حذف طلب ${r.user_name || r.user_email} نهائياً؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف', style: 'destructive', onPress: async () => {
          setBusyId(r.id);
          try {
            await adminDeleteSubscriptionRequest(r.id);
            setRequests((s) => (s || []).filter((x) => x.id !== r.id));
          } catch (e: any) {
            Alert.alert('فشل الحذف', e?.message || 'حاول مرة أخرى.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  if (initialized && !user) return <Redirect href="/(auth)/login" />;
  if (initialized && user && !isAdmin) {
    return <Screen><ErrorState message="غير مصرح — هذه الصفحة متاحة لمديري المنصة فقط." /></Screen>;
  }
  if (requests === null && !error) {
    return <Screen><Loading text="جاري تحميل الطلبات..." /></Screen>;
  }

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Text style={typography.h3}>📋 طلبات الاشتراك المعلقة</Text>
        <Text style={typography.caption}>{requests?.length || 0} طلب بانتظار المراجعة</Text>
      </View>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      <FlatList
        data={requests || []}
        keyExtractor={(r) => r.id}
        refreshing={refreshing}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="لا توجد طلبات معلقة" hint="طلبات الاشتراك الجديدة بإيصالات الدفع تظهر هنا" />}
        renderItem={({ item }) => {
          const busy = busyId === item.id;
          return (
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3} numberOfLines={1}>{item.user_name || '—'}</Text>
                  <Text style={typography.caption} numberOfLines={1}>{item.user_email}</Text>
                  {item.user_phone ? <Text style={typography.caption} numberOfLines={1}>📱 {item.user_phone}</Text> : null}
                  {item.user_subject ? <Text style={typography.caption} numberOfLines={1}>📚 {item.user_subject}</Text> : null}
                  <Text style={[typography.caption, styles.planLine]} numberOfLines={2}>
                    📦 {planLabel(item)} • {item.billing_cycle === 'yearly' ? 'سنوي' : 'شهري'}
                  </Text>
                  <Text style={typography.caption}>🗓 {item.created_at ? new Date(item.created_at).toLocaleString('ar-EG') : '—'}</Text>
                </View>
                {item.screenshot_data ? (
                  <Pressable onPress={() => setReceiptView(item.screenshot_data!)}>
                    <Image source={{ uri: item.screenshot_data }} style={styles.thumb} resizeMode="cover" />
                    <Text style={styles.thumbHint}>اضغط للتكبير</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.actionsRow}>
                <Button title={busy ? 'جاري التفعيل...' : '✅ تفعيل تلقائي'} onPress={() => approve(item)} loading={busy} style={{ flex: 1 }} />
                <Button title="🗑 رفض" variant="secondary" onPress={() => reject(item)} disabled={busy} />
              </View>
            </Card>
          );
        }}
      />
      <Modal visible={!!receiptView} transparent animationType="fade" onRequestClose={() => setReceiptView(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setReceiptView(null)}>
          {receiptView ? <Image source={{ uri: receiptView }} style={styles.viewerImage} resizeMode="contain" /> : null}
          <Text style={styles.viewerHint}>اضغط في أي مكان للإغلاق</Text>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, paddingBottom: 4, alignItems: 'flex-end', gap: 4 },
  list: { padding: 16, flexGrow: 1 },
  row: { flexDirection: 'row-reverse', gap: 12, alignItems: 'flex-start' },
  planLine: { color: colors.primary, fontWeight: '700', marginTop: 4 },
  thumb: { width: 84, height: 110, borderRadius: radius.sm, backgroundColor: colors.border, borderWidth: 1, borderColor: colors.border },
  thumbHint: { fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 3 },
  actionsRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '92%', height: '80%' },
  viewerHint: { color: '#ccc', marginTop: 12, fontSize: 12 },
});
