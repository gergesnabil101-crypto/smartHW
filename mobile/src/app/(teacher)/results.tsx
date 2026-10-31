import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Loading, EmptyState, ErrorState } from '../../components/Feedback';
import { listTeacherResults } from '../../lib/services';
import type { StudentResult } from '../../types';
import { colors, radius, typography } from '../../theme';

export default function ResultsScreen() {
  const router = useRouter();
  const [results, setResults] = useState<StudentResult[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await listTeacherResults();
      setResults(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل النتائج.');
      setResults([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return results || [];
    return (results || []).filter((r) =>
      `${r.student_name} ${r.quiz_title} ${r.center_name ?? ''}`.toLowerCase().includes(q)
    );
  }, [results, search]);

  if (results === null && !error) {
    return <Screen><Loading text="جاري تحميل النتائج..." /></Screen>;
  }

  return (
    <Screen scroll={false}>
      <View style={styles.searchWrap}>
        <Input placeholder="ابحث باسم الطالب أو الاختبار..." value={search} onChangeText={setSearch} />
      </View>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      <FlatList
        data={filtered}
        keyExtractor={(r) => String(r.id)}
        refreshing={refreshing}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="لا توجد نتائج" hint="نتائج الطلاب ستظهر هنا بعد تسليمهم للاختبارات" />}
        renderItem={({ item }) => {
          const pct = item.total ? Math.round((Number(item.score) / Number(item.total)) * 100) : 0;
          return (
            <Card onPress={() => router.push(`/(teacher)/result/${item.id}?quizId=${item.quiz_id || ''}`)}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3} numberOfLines={1}>{item.student_name}</Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {item.quiz_title || 'اختبار'} • {formatDate(item.created_at)}
                  </Text>
                </View>
                <View style={[styles.scoreBadge, pct >= 50 ? styles.scorePass : styles.scoreFail]}>
                  <Text style={styles.scoreText}>{item.score}/{item.total}</Text>
                  <Text style={styles.pctText}>{pct}%</Text>
                </View>
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

function formatDate(d: string | number | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  searchWrap: { padding: 16, paddingBottom: 4 },
  list: { padding: 16, flexGrow: 1 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  scoreBadge: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 64 },
  scorePass: { backgroundColor: colors.successSoft },
  scoreFail: { backgroundColor: colors.dangerSoft },
  scoreText: { fontWeight: '800', fontSize: 15, color: colors.text },
  pctText: { fontSize: 11, color: colors.textMuted },
});
