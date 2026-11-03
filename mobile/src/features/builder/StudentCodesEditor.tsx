import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import type { StudentCode } from '../../types';
import { colors, radius, typography } from '../../theme';

interface Props {
  codes: StudentCode[];
  onChange: (codes: StudentCode[]) => void;
}

const genCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

/** Manage per-student access codes for quizzes requiring a code. */
export function StudentCodesEditor({ codes, onChange }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const add = (autoCode?: string) => {
    const student_name = name.trim();
    if (!student_name) return Alert.alert('الاسم مطلوب', 'أدخل اسم الطالب قبل إضافة كود.');
    const code = (autoCode || genCode()).toUpperCase();
    if (codes.some((c) => c.code === code)) return add();
    onChange([...codes, { code, student_name, parent_phone: phone.trim() || undefined }]);
    setName('');
    setPhone('');
  };

  const bulkGenerate = () => {
    const count = 10;
    const next = [...codes];
    for (let i = 0; i < count; i++) {
      let code = genCode();
      while (next.some((c) => c.code === code)) code = genCode();
      next.push({ code, student_name: `طالب ${next.length + 1}` });
    }
    onChange(next);
  };

  const remove = (code: string) => onChange(codes.filter((c) => c.code !== code));

  return (
    <View>
      <View style={styles.headRow}>
        <Text style={typography.label}>أكواد الطلاب ({codes.length})</Text>
        <Pressable onPress={bulkGenerate}>
          <Text style={styles.bulkLink}>+ توليد 10 أكواد</Text>
        </Pressable>
      </View>

      <View style={styles.addRow}>
        <View style={{ flex: 2 }}>
          <Input placeholder="اسم الطالب" value={name} onChangeText={setName} />
        </View>
        <View style={{ flex: 1.4 }}>
          <Input placeholder="هاتف ولي الأمر" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>
        <Button title="إضافة" variant="secondary" onPress={() => add()} />
      </View>

      {codes.map((c) => (
        <View key={c.code} style={styles.codeRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.body} numberOfLines={1}>{c.student_name}</Text>
            {c.parent_phone ? <Text style={typography.caption}>{c.parent_phone}</Text> : null}
          </View>
          <View style={[styles.codeBadge, c.used && styles.codeBadgeUsed]}>
            <Text style={styles.codeText}>{c.code}</Text>
            {c.used ? <Text style={styles.usedText}>مستخدم</Text> : null}
          </View>
          <Pressable onPress={() => remove(c.code)} hitSlop={8}>
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bulkLink: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  codeRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border,
  },
  codeBadge: { backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center' },
  codeBadgeUsed: { backgroundColor: colors.dangerSoft },
  codeText: { fontWeight: '800', color: colors.primary, letterSpacing: 1 },
  usedText: { fontSize: 9, color: colors.danger, fontWeight: '700' },
  remove: { color: colors.danger, fontWeight: '700', padding: 4 },
});
