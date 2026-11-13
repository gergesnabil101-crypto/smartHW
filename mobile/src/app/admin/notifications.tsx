import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Loading, EmptyState, ErrorState } from '../../components/Feedback';
import { db } from '../../lib/firebase';
import { listAdminUsers } from '../../lib/services';
import { useAuth, isAdminUser } from '../../store/AuthContext';
import { colors, radius, typography } from '../../theme';

interface Notif {
  id: string;
  title: string;
  message: string;
  targetType: 'all' | 'grade' | 'subject' | 'teacher' | 'teachers' | 'teacher_direct';
  targetValue: string;
  sender_email?: string;
  created_at?: string;
}

const TARGET_TYPES = [
  { key: 'all' as const, label: 'جميع الطلاب' },
  { key: 'grade' as const, label: 'طلاب مرحلة دراسية' },
  { key: 'subject' as const, label: 'طلاب مادة' },
  { key: 'teacher' as const, label: 'طلاب معلم معين' },
  { key: 'teachers' as const, label: 'جميع المعلمين' },
  { key: 'teacher_direct' as const, label: 'معلم معين (شخصي)' },
];

/** Admin broadcast center — mirrors the legacy web notification panel. */
export default function AdminNotificationsScreen() {
  const { initialized, user, profile } = useAuth();
  const isAdmin = isAdminUser(profile as any, user?.email);
  const [notifs, setNotifs] = useState<Notif[] | null>(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<Notif['targetType']>('all');
  const [targetValue, setTargetValue] = useState('');
  const [valueOptions, setValueOptions] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const needsValue = targetType !== 'all' && targetType !== 'teachers';

  // Build unique target values (grades / subjects / teachers) from the students registry + admin users
  const loadTargets = useCallback(async () => {
    try {
      const set = new Set<string>();
      if (targetType === 'teacher_direct') {
        // Target a teacher account itself — names come from the admin user list
        const users = await listAdminUsers().catch(() => []);
        (users || []).forEach((u: any) => {
          const n = String(u.name || '').trim();
          if (n) set.add(n);
        });
      }
      const snap = await getDocs(collection(db, 'students'));
      snap.forEach((d) => {
        const s = d.data() as any;
        const v = targetType === 'grade' ? s.grade_level : targetType === 'subject' ? s.subject : (s.teacher_name || '');
        if (v && String(v).trim()) set.add(String(v).trim());
      });
      setValueOptions(Array.from(set).sort((a, b) => a.localeCompare(b, 'ar')));
    } catch { /* non-fatal — free text remains available */ }
  }, [targetType]);

  useEffect(() => { if (needsValue) loadTargets(); }, [needsValue, loadTargets]);

  const load = useCallback(async () => {
    setError('');
    try {
      const snap = await getDocs(collection(db, 'notifications'));
      const list: Notif[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      setNotifs(list);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل الإشعارات.');
      setNotifs([]);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const send = async () => {
    if (!title.trim() || !message.trim()) return Alert.alert('ناقص', 'أدخل عنواناً ورسالة للإشعار.');
    if (needsValue && !targetValue.trim()) return Alert.alert('ناقص', 'اختر أو اكتب قيمة الاستهداف (المرحلة/المادة/المعلم).');
    setSending(true);
    try {
      const ref = doc(collection(db, 'notifications'));
      await setDoc(ref, {
        id: ref.id,
        title: title.trim(),
        message: message.trim(),
        targetType,
        targetValue: needsValue ? targetValue.trim() : 'الكل',
        sender_email: user?.email || 'gergesnabil101@gmail.com',
        created_at: new Date().toISOString(),
      });
      setTitle(''); setMessage(''); setTargetValue('');
      await load();
      Alert.alert('تم الإرسال ✅', 'وصل الإشعار للطلاب المستهدفين.');
    } catch (e: any) {
      Alert.alert('فشل الإرسال', e?.message || 'حاول مرة أخرى.');
    } finally {
      setSending(false);
    }
  };

  const remove = async (n: Notif) => {
    Alert.alert('حذف الإشعار', `حذف «${n.title}»؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        setBusyId(n.id);
        try {
          await deleteDoc(doc(db, 'notifications', n.id));
          setNotifs((s) => (s || []).filter((x) => x.id !== n.id));
        } catch (e: any) {
          Alert.alert('فشل الحذف', e?.message || 'حاول مرة أخرى.');
        } finally { setBusyId(null); }
      } },
    ]);
  };

  const targetLabel = (n: Notif) =>
    n.targetType === 'all' ? 'جميع الطلاب'
    : n.targetType === 'teachers' ? 'جميع المعلمين'
    : n.targetType === 'grade' ? `طلاب المرحلة: ${n.targetValue}`
    : n.targetType === 'subject' ? `طلاب المادة: ${n.targetValue}`
    : n.targetType === 'teacher' ? `طلاب المعلم: ${n.targetValue}`
    : `المعلم (شخصي): ${n.targetValue}`;

  if (initialized && !user) return <Redirect href="/(auth)/login" />;
  if (notifs === null && !error) return <Screen><Loading text="جاري التحميل..." /></Screen>;
  if (initialized && user && !isAdmin && notifs !== null && !error) {
    return <Screen><ErrorState message="غير مصرح — هذه الصفحة متاحة لمديري المنصة فقط." /></Screen>;
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={notifs || []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Card>
            <Text style={typography.h3}>🔔 مركز الإشعارات</Text>
            <Text style={[typography.caption, { textAlign: 'right', marginBottom: 8 }]}>
              إشعار فوري يظهر للطلاب فور دخولهم التطبيق حسب التصنيف.
            </Text>
            <Input label="عنوان الإشعار" value={title} onChangeText={setTitle} placeholder="مثال: تنبيه هام بشأن موعد الامتحان" />
            <Input label="محتوى الإشعار" value={message} onChangeText={setMessage} multiline placeholder="اكتب تفاصيل الإشعار..." />
            <Text style={typography.label}>تصنيف الاستهداف:</Text>
            <View style={styles.chipsRow}>
              {TARGET_TYPES.map((t) => (
                <Pressable key={t.key} onPress={() => { setTargetType(t.key); setTargetValue(''); }} style={[styles.chip, targetType === t.key && styles.chipOn]}>
                  <Text style={[styles.chipText, targetType === t.key && styles.chipTextOn]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
            {needsValue ? (
              <>
                <Pressable style={styles.selectBox} onPress={() => setPickerOpen(true)}>
                  <Text style={styles.selectLabel}>
                    {targetType === 'grade' ? 'المرحلة:' : targetType === 'subject' ? 'المادة:' : 'المعلم:'}
                  </Text>
                  <Text style={styles.selectValue} numberOfLines={1}>{targetValue || '— اختر من القائمة —'}</Text>
                  <Text style={styles.selectArrow}>▾</Text>
                </Pressable>
                <Input placeholder="أو اكتب القيمة يدوياً..." value={targetValue} onChangeText={setTargetValue} />
              </>
            ) : null}
            <Button title={sending ? 'جاري الإرسال...' : '📤 إرسال الإشعار الآن'} onPress={send} loading={sending} />
            <Text style={[typography.caption, { textAlign: 'right', marginTop: 10 }]}>الإشعارات النشطة ({notifs?.length || 0}):</Text>
          </Card>
        }
        ListEmptyComponent={<EmptyState title="لا توجد إشعارات" />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.h3} numberOfLines={1}>{item.title}</Text>
                <Text style={typography.caption} numberOfLines={3}>{item.message}</Text>
                <Text style={[typography.caption, { color: colors.primary, marginTop: 4 }]}>التصنيف: {targetLabel(item)}</Text>
                <Text style={typography.caption}>{item.created_at ? new Date(item.created_at).toLocaleString('ar-EG') : ''}</Text>
              </View>
              <Pressable onPress={() => remove(item)} disabled={busyId === item.id} style={styles.delBtn}>
                <Text style={{ color: colors.danger, fontWeight: '800' }}>🗑</Text>
              </Pressable>
            </View>
          </Card>
        )}
      />
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>اختر قيمة الاستهداف</Text>
            <FlatList
              data={valueOptions}
              keyExtractor={(v) => v}
              style={{ maxHeight: 340 }}
              ListEmptyComponent={<Text style={typography.caption}>لا توجد قيم مسجلة — اكتبها يدوياً في الحقل.</Text>}
              renderItem={({ item }) => (
                <Pressable style={styles.optionRow} onPress={() => { setTargetValue(item); setPickerOpen(false); }}>
                  <Text style={styles.optionText}>{item}</Text>
                  {targetValue === item ? <Text style={styles.optionCheck}>✓</Text> : null}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, flexGrow: 1 },
  chipsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  chipTextOn: { color: '#fff' },
  selectBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10 },
  selectLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  selectValue: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'right' },
  selectArrow: { fontSize: 14, color: colors.textMuted },
  notifRow: { flexDirection: 'row-reverse', gap: 10, alignItems: 'flex-start' },
  delBtn: { padding: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, maxHeight: '80%' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'right', marginBottom: 10 },
  optionRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 10, borderRadius: radius.sm },
  optionText: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'right', flex: 1 },
  optionCheck: { fontSize: 15, fontWeight: '800', color: colors.primary },
});
