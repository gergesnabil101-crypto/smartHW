import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import type { Question } from '../../types';
import { colors, radius, typography } from '../../theme';

const TYPES = [
  { key: 'multiple-choice', label: 'اختيار من متعدد' },
  { key: 'true-false', label: 'صح / خطأ' },
  { key: 'essay', label: 'مقالي' },
] as const;

interface Props {
  initial: Question;
  onSave: (q: Question) => void;
  onCancel: () => void;
}

/** Modal editor for a single question. */
export function QuestionEditor({ initial, onSave, onCancel }: Props) {
  const [text, setText] = useState(initial.text || '');
  const [type, setType] = useState<NonNullable<Question['type']>>(initial.type || 'multiple-choice');
  const [points, setPoints] = useState(String(initial.points ?? 1));
  const [options, setOptions] = useState<string[]>(
    initial.options?.length ? [...initial.options] : ['', '', '', '']
  );
  const [correctIndex, setCorrectIndex] = useState(initial.correctOptionIndex ?? 0);
  const [modelAnswer, setModelAnswer] = useState(initial.modelAnswer || '');
  const [reqPoints, setReqPoints] = useState(String(initial.required_points_count ?? ''));
  const [error, setError] = useState('');

  const save = () => {
    if (!text.trim()) return setError('نص السؤال مطلوب.');
    const pts = Math.max(0.25, parseFloat(points) || 1);
    if (type === 'multiple-choice') {
      const filled = options.map((o) => o.trim()).filter(Boolean);
      if (filled.length < 2) return setError('أدخل خيارين على الأقل.');
      onSave({
        ...initial,
        text: text.trim(),
        type,
        points: pts,
        options: filled,
        correctOptionIndex: Math.min(correctIndex, filled.length - 1),
        modelAnswer: modelAnswer.trim() || undefined,
      });
      return;
    }
    onSave({
      ...initial,
      text: text.trim(),
      type,
      points: pts,
      options: type === 'true-false' ? ['صح', 'خطأ'] : [],
      correctOptionIndex: type === 'true-false' ? correctIndex : 0,
      modelAnswer: modelAnswer.trim() || undefined,
      required_points_count: type === 'essay' && reqPoints ? parseInt(reqPoints) : undefined,
    });
  };

  return (
    <View>
      <View style={styles.typeRow}>
        {TYPES.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setType(t.key)}
            style={[styles.typeChip, type === t.key && styles.typeChipActive]}
          >
            <Text style={[styles.typeChipText, type === t.key && styles.typeChipTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Input label="نص السؤال" value={text} onChangeText={setText} multiline numberOfLines={3} style={styles.multi} />
      <Input label="الدرجة" value={points} onChangeText={setPoints} keyboardType="numeric" />

      {type === 'multiple-choice' ? (
        <View>
          <Text style={typography.label}>الخيارات (اختر الصحيحة)</Text>
          {options.map((opt, i) => (
            <View key={i} style={styles.optionRow}>
              <Pressable onPress={() => setCorrectIndex(i)} style={[styles.radio, correctIndex === i && styles.radioOn]} />
              <View style={{ flex: 1 }}>
                <Input
                  placeholder={`الخيار ${['أ', 'ب', 'ج', 'د'][i] || i + 1}`}
                  value={opt}
                  onChangeText={(t) => setOptions((prev) => prev.map((o, j) => (j === i ? t : o)))}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {type === 'true-false' ? (
        <View style={styles.tfRow}>
          {['صح', 'خطأ'].map((label, i) => (
            <Pressable
              key={label}
              onPress={() => setCorrectIndex(i)}
              style={[styles.tfChip, correctIndex === i && styles.typeChipActive]}
            >
              <Text style={[styles.typeChipText, correctIndex === i && styles.typeChipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {type === 'essay' ? (
        <>
          <Input label="الإجابة النموذجية" value={modelAnswer} onChangeText={setModelAnswer} multiline numberOfLines={3} style={styles.multi} />
          <Input label="عدد النقاط المطلوبة في الإجابة (اختياري)" value={reqPoints} onChangeText={setReqPoints} keyboardType="numeric" />
        </>
      ) : (
        <Input label="ملاحظة / تفسير الإجابة (اختياري)" value={modelAnswer} onChangeText={setModelAnswer} />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button title="حفظ السؤال" onPress={save} style={{ flex: 1 }} />
        <Button title="إلغاء" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 14 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  typeChipTextActive: { color: '#fff' },
  tfRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 14 },
  tfChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  multi: { minHeight: 80, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, marginTop: 8 },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  error: { color: colors.danger, textAlign: 'right', writingDirection: 'rtl', marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
