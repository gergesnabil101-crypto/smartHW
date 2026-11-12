import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Loading, EmptyState, ErrorState } from '../../components/Feedback';
import { db } from '../../lib/firebase';
import { listAdminUsers } from '../../lib/services';
import { useAuth, isAdminUser } from '../../store/AuthContext';
import { colors, typography } from '../../theme';

interface UsageRow {
  user_id: string;
  user_name: string;
  user_email: string;
  plan: string;
  prompt_tokens: number;
  candidates_tokens: number;
  total_tokens: number;
  ops: Record<string, number>;
}

const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  const d = new Date(typeof v === 'object' && v.seconds ? v.seconds * 1000 : v);
  return isNaN(d.getTime()) ? null : d;
};

const OP_LABELS: Record<string, string> = {
  essay_grading: 'تصحيح مقالي',
  doc_extraction: 'استخراج أسئلة',
  quiz_generation: 'توليد أسئلة',
  generate_quiz: 'توليد أسئلة',
  image_ocr: 'قراءة صور/OCR',
  general: 'معالجة عامة',
};

/** Daily token consumption across all accounts — sourced from token_usage_logs. */
export default function AdminUsageScreen() {
  const { initialized, user, profile } = useAuth();
  const isAdmin = isAdminUser(profile as any, user?.email);
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const [error, setError] = useState('');
  const [totals, setTotals] = useState({ input: 0, output: 0, total: 0 });

  const load = useCallback(async () => {
    setError('');
    try {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const q = query(collection(db, 'token_usage_logs'), where('timestamp', '>=', dayStart), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);

      // Map uid/email → plan name
      let planById: Record<string, string> = {};
      try {
        const users = await listAdminUsers();
        users.forEach((u: any) => {
          const plan = u.preferred_ai_model === 'gemini_pro' || String(u.subscription_type || '').includes('pro') ? '👑 برو' : '⚡ فلاش';
          if (u.uid || u.id) planById[u.uid || u.id] = plan;
          if (u.email) planById[u.email] = plan;
        });
      } catch { /* plan map is best-effort */ }

      const agg = new Map<string, UsageRow>();
      const t = { input: 0, output: 0, total: 0 };
      snap.forEach((d) => {
        const l = d.data() as any;
        const key = String(l.user_id || l.user_email || 'unknown');
        const row: UsageRow = agg.get(key) || {
          user_id: key, user_name: l.user_name || '', user_email: l.user_email || '',
          plan: planById[key] || planById[l.user_email] || '—',
          prompt_tokens: 0, candidates_tokens: 0, total_tokens: 0, ops: {},
        };
        row.prompt_tokens += Number(l.prompt_tokens || 0);
        row.candidates_tokens += Number(l.candidates_tokens || 0);
        row.total_tokens += Number(l.total_tokens || 0);
        const op = String(l.operation || 'general');
        row.ops[op] = (row.ops[op] || 0) + 1;
        agg.set(key, row);
        t.input += Number(l.prompt_tokens || 0);
        t.output += Number(l.candidates_tokens || 0);
        t.total += Number(l.total_tokens || 0);
      });
      setRows(Array.from(agg.values()).sort((a, b) => b.total_tokens - a.total_tokens));
      setTotals(t);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل استهلاك اليوم.');
      setRows([]);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (initialized && !user) return <Redirect href="/(auth)/login" />;
  if (rows === null && !error) return <Screen><Loading text="جاري تحميل استهلاك اليوم..." /></Screen>;
  if (initialized && user && !isAdmin && rows !== null && !error) {
    return <Screen><ErrorState message="غير مصرح — هذه الصفحة متاحة لمديري المنصة فقط." /></Screen>;
  }

  const fmt = (n: number) => n.toLocaleString('en');

  return (
    <Screen scroll={false}>
      <FlatList
        data={rows || []}
        keyExtractor={(r) => r.user_id}
        contentContainerStyle={styles.list}
        onRefresh={load}
        refreshing={rows === null}
        ListHeaderComponent={
          <Card style={styles.totalsCard}>
            <Text style={typography.h3}>📊 استهلاك اليوم — {new Date().toLocaleDateString('ar-EG')}</Text>
            {error ? <ErrorState message={error} onRetry={load} /> : null}
            <View style={styles.totalsRow}>
              <View style={styles.totalBox}>
                <Text style={styles.totalNum}>{fmt(totals.input)}</Text>
                <Text style={styles.totalLabel}>مدخلات 📥</Text>
              </View>
              <View style={styles.totalBox}>
                <Text style={styles.totalNum}>{fmt(totals.output)}</Text>
                <Text style={styles.totalLabel}>مخرجات 📤</Text>
              </View>
              <View style={styles.totalBox}>
                <Text style={[styles.totalNum, { color: colors.primary }]}>{fmt(totals.total)}</Text>
                <Text style={styles.totalLabel}>الإجمالي ⚡</Text>
              </View>
            </View>
            <Text style={[typography.caption, { textAlign: 'right' }]}>{rows?.length || 0} حساب نشط اليوم — اسحب للتحديث</Text>
          </Card>
        }
        ListEmptyComponent={<EmptyState title="لا يوجد استهلاك اليوم" />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.headRow}>
              <Text style={typography.h3} numberOfLines={1}>{item.user_name || item.user_email || '—'}</Text>
              <Text style={styles.planBadge}>{item.plan}</Text>
            </View>
            <Text style={typography.caption} numberOfLines={1}>{item.user_email}</Text>
            <View style={styles.totalsRow}>
              <View style={styles.totalBox}>
                <Text style={styles.smallNum}>{fmt(item.prompt_tokens)}</Text>
                <Text style={styles.totalLabel}>مدخلات</Text>
              </View>
              <View style={styles.totalBox}>
                <Text style={styles.smallNum}>{fmt(item.candidates_tokens)}</Text>
                <Text style={styles.totalLabel}>مخرجات</Text>
              </View>
              <View style={styles.totalBox}>
                <Text style={[styles.smallNum, { color: colors.primary }]}>{fmt(item.total_tokens)}</Text>
                <Text style={styles.totalLabel}>الإجمالي</Text>
              </View>
            </View>
            {Object.keys(item.ops).length ? (
              <Text style={typography.caption}>
                العمليات: {Object.entries(item.ops).map(([op, n]) => `${OP_LABELS[op] || op} ×${n}`).join(' • ')}
              </Text>
            ) : null}
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, flexGrow: 1 },
  totalsCard: { marginBottom: 8 },
  totalsRow: { flexDirection: 'row-reverse', justifyContent: 'space-around', marginVertical: 10 },
  totalBox: { alignItems: 'center', minWidth: 80 },
  totalNum: { fontSize: 18, fontWeight: '900', color: colors.text },
  smallNum: { fontSize: 15, fontWeight: '800', color: colors.text },
  totalLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  headRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  planBadge: { fontSize: 12, fontWeight: '800', color: colors.text, backgroundColor: colors.primarySoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
});
