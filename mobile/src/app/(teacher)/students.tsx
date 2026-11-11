import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { useAuth } from '../../store/AuthContext';
import { db } from '../../lib/firebase';
import { listTeacherResults } from '../../lib/services';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Loading, EmptyState, ErrorState } from '../../components/Feedback';
import { colors, radius, typography } from '../../theme';

type StudentRow = {
  id: string;
  name: string;
  phone: string;
  parent_phone?: string;
  center_name?: string;
  exams_taken?: number;
  last_score?: number | null;
  total_score?: number | null;
  code?: string;
  docId?: string; // Firestore doc id when the student exists in `students` collection
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (I/O/0/1)
const genCode = () =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
const safeId = (s: string) => s.replace(/[\/.\s#$\[\]]/g, '_').slice(0, 90);

export default function StudentsScreen() {
  const { user, profile } = useAuth();
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [centerFilter, setCenterFilter] = useState('all');
  const [centerPickerOpen, setCenterPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setError('');
    try {
      // 1) Students already registered in the `students` collection for this teacher
      const byKey = new Map<string, StudentRow>();
      const snap = await getDocs(query(collection(db, 'students'), where('teacher_id', '==', user.uid)));
      snap.forEach((d) => {
        const s = d.data() as any;
        const key = `${s.name || ''}_${s.phone || ''}`;
        byKey.set(key, {
          id: s.id || d.id,
          docId: d.id,
          name: s.name || 'طالب',
          phone: s.phone || '',
          parent_phone: s.parent_phone || '',
          center_name: s.center_name || '',
          exams_taken: s.exams_taken,
          last_score: s.last_score,
          total_score: s.total_score,
          code: s.code || '',
        });
      });

      // 2) Merge students derived from this teacher's results (not yet in collection)
      const results = await listTeacherResults().catch(() => []);
      (results || [])
        .filter((r: any) => !r.teacher_id || r.teacher_id === user.uid || r.user_id === user.uid)
        .forEach((r: any) => {
          const name = (r.student_name || 'طالب').trim();
          const phone = (r.student_phone || r.phone || '').trim();
          const key = `${name}_${phone}`;
          const existing = byKey.get(key);
          if (existing) {
            existing.exams_taken = (existing.exams_taken || 0) + 1;
          } else {
            byKey.set(key, {
              id: key,
              name,
              phone,
              parent_phone: r.parent_phone || '',
              center_name: r.center_name || '',
              exams_taken: 1,
              last_score: r.score,
              total_score: r.total,
            });
          }
        });

      const list = Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      setStudents(list);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل بيانات الطلاب.');
      setStudents([]);
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const uniqueCenters = useMemo(() => {
    const set = new Set<string>();
    (students || []).forEach((s) => {
      const name = String(s.center_name || '').trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [students]);

  const filtered = useMemo(() => {
    let list = students || [];
    if (centerFilter !== 'all') {
      list = centerFilter === '__none__'
        ? list.filter((s) => !String(s.center_name || '').trim())
        : list.filter((s) => String(s.center_name || '').trim() === centerFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => `${s.name} ${s.phone} ${s.center_name ?? ''}`.toLowerCase().includes(q));
  }, [students, search, centerFilter]);

  const createCode = async (s: StudentRow) => {
    if (!user?.uid) return;
    setBusyId(s.id);
    try {
      // Generate a platform-wide unique code (server validates codes globally)
      let code = genCode();
      for (let i = 0; i < 5; i++) {
        const dup = await getDocs(query(collection(db, 'students'), where('code', '==', code)));
        if (dup.empty) break;
        code = genCode();
      }
      const docId = s.docId || safeId(`${s.name}_${s.phone || Date.now()}`);
      await setDoc(doc(db, 'students', docId), {
        id: docId,
        name: s.name,
        phone: s.phone || '',
        parent_phone: s.parent_phone || '',
        center_name: s.center_name || '',
        teacher_id: user.uid,
        teacher_name: profile?.name || user.displayName || '',
        code,
        last_date: new Date().toISOString(),
        ...(typeof s.exams_taken === 'number' ? { exams_taken: s.exams_taken } : {}),
        ...(typeof s.last_score === 'number' ? { last_score: s.last_score } : {}),
        ...(typeof s.total_score === 'number' ? { total_score: s.total_score } : {}),
      }, { merge: true });
      await load();
      Alert.alert('تم إنشاء الكود', `كود الطالب ${s.name}: ${code}\nهذا الكود ثابت ويستخدمه الطالب في كل اختباراتك المحمية بكود.`);
    } catch (e: any) {
      Alert.alert('فشل إنشاء الكود', e?.message || 'حاول مرة أخرى.');
    } finally {
      setBusyId(null);
    }
  };

  const normPhone = (raw?: string): string => {
    let phone = String(raw || '').trim().replace(/[^0-9+]/g, '');
    if (phone.startsWith('+')) phone = phone.substring(1);
    if (phone.startsWith('01')) phone = '2' + phone;
    else if (phone.startsWith('1') && phone.length === 10) phone = '20' + phone;
    return phone;
  };

  const chatWhatsApp = async (s: StudentRow) => {
    const phone = normPhone(s.phone);
    if (!phone) return Alert.alert('لا يوجد رقم', 'لا يوجد رقم هاتف مسجل لهذا الطالب.');
    try {
      await Linking.openURL(`https://wa.me/${phone}`);
    } catch {
      Alert.alert('خطأ', 'تعذر فتح واتساب.');
    }
  };

  const deleteStudent = (s: StudentRow) => {
    if (!s.docId) return Alert.alert('غير متاح', 'هذا الطالب موجود في النتائج فقط ولا يمكن حذفه من سجل الطلاب.');
    Alert.alert('حذف الطالب', `حذف ${s.name} وكوده من سجل طلابك؟ (نتائجه السابقة لن تُحذف)`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف', style: 'destructive', onPress: async () => {
          setBusyId(s.id);
          try {
            await deleteDoc(doc(db, 'students', s.docId!));
            await load();
          } catch (e: any) {
            Alert.alert('فشل الحذف', e?.message || 'حاول مرة أخرى.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const sendCode = async (s: StudentRow) => {
    let phone = String(s.phone || '').trim().replace(/[^0-9+]/g, '');
    if (!phone) return Alert.alert('لا يوجد رقم', 'لا يوجد رقم هاتف مسجل لهذا الطالب.');
    if (phone.startsWith('+')) phone = phone.substring(1);
    if (phone.startsWith('01')) phone = '2' + phone;
    else if (phone.startsWith('1') && phone.length === 10) phone = '20' + phone;
    const teacherName = profile?.name || user?.displayName || 'مدرسك';
    const msg = `مرحباً ${s.name}،\nكودك الخاص للدخول على اختبارات المدرس ${teacherName} هو: ${s.code}\nاحتفظ بهذا الكود — ستستخدمه في كل الاختبارات القادمة.`;
    try {
      await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
    } catch {
      Alert.alert('خطأ', 'تعذر فتح واتساب.');
    }
  };

  if (students === null && !error) {
    return <Screen><Loading text="جاري تحميل بيانات الطلاب..." /></Screen>;
  }

  return (
    <Screen scroll={false}>
      <View style={styles.searchWrap}>
        <Input placeholder="ابحث باسم الطالب أو الهاتف أو السنتر/المجموعة..." value={search} onChangeText={setSearch} />
        <Pressable style={styles.selectBox} onPress={() => setCenterPickerOpen(true)}>
          <Text style={styles.selectLabel}>السنتر / المجموعة:</Text>
          <Text style={styles.selectValue} numberOfLines={1}>
            {centerFilter === 'all' ? 'الكل' : centerFilter === '__none__' ? 'بدون سنتر' : centerFilter}
          </Text>
          <Text style={styles.selectArrow}>▾</Text>
        </Pressable>
        <Modal visible={centerPickerOpen} transparent animationType="fade" onRequestClose={() => setCenterPickerOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCenterPickerOpen(false)}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>اختر السنتر / المجموعة</Text>
              <FlatList
                data={['all', ...uniqueCenters, '__none__']}
                keyExtractor={(c) => c}
                style={{ maxHeight: 340 }}
                renderItem={({ item }) => {
                  const label = item === 'all' ? 'الكل' : item === '__none__' ? 'بدون سنتر' : item;
                  const active = centerFilter === item;
                  return (
                    <Pressable
                      style={[styles.optionRow, active && styles.optionRowActive]}
                      onPress={() => { setCenterFilter(item); setCenterPickerOpen(false); }}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
                      {active ? <Text style={styles.optionCheck}>✓</Text> : null}
                    </Pressable>
                  );
                }}
              />
            </View>
          </Pressable>
        </Modal>
        <Text style={[typography.caption, { textAlign: 'right', marginTop: 6 }]}>
          {filtered.length} طالب — الكود ثابت ويُستخدم في كل اختباراتك المحمية بكود
        </Text>
      </View>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        refreshing={refreshing}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="لا يوجد طلاب بعد" hint="سيظهر هنا طلابك تلقائياً بعد أول تسليم لاختباراتك" />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={typography.h3} numberOfLines={1}>{item.name}</Text>
                <Text style={typography.caption} numberOfLines={1}>
                  {[item.phone, item.center_name, item.exams_taken ? `${item.exams_taken} اختبار` : ''].filter(Boolean).join(' • ')}
                </Text>
              </View>
              {item.code ? (
                <View style={styles.codeBadge}>
                  <Text style={styles.codeText}>{item.code}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.actions}>
              {item.code ? (
                <Button title="📱 إرسال الكود للطالب" variant="secondary" onPress={() => sendCode(item)} />
              ) : (
                <Button
                  title={busyId === item.id ? 'جاري الإنشاء...' : '🔑 إنشاء كود خاص بالطالب'}
                  variant="secondary"
                  onPress={() => createCode(item)}
                  loading={busyId === item.id}
                />
              )}
              <View style={styles.actionsRow}>
                <Pressable onPress={() => chatWhatsApp(item)} style={styles.actionChip} disabled={!item.phone}>
                  <Text style={[styles.actionChipText, { color: item.phone ? colors.success : colors.textMuted }]}>💬 واتساب</Text>
                </Pressable>
                {item.docId ? (
                  <Pressable onPress={() => deleteStudent(item)} style={styles.actionChip} disabled={busyId === item.id}>
                    <Text style={[styles.actionChipText, { color: colors.danger }]}>🗑 حذف</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { padding: 16, paddingBottom: 4 },
  list: { padding: 16, flexGrow: 1 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  codeBadge: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  codeText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 2 },
  actions: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, alignItems: 'flex-end' },
  actionsRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 8 },
  actionChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  actionChipText: { fontSize: 12, fontWeight: '700' },
  selectBox: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10,
  },
  selectLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  selectValue: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'right' },
  selectArrow: { fontSize: 14, color: colors.textMuted },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, maxHeight: '80%' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'right', marginBottom: 10 },
  optionRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 10, borderRadius: radius.sm },
  optionRowActive: { backgroundColor: colors.primarySoft },
  optionText: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'right', flex: 1 },
  optionTextActive: { color: colors.primary },
  optionCheck: { fontSize: 15, fontWeight: '800', color: colors.primary },
});
