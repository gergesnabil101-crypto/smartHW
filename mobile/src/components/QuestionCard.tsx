import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Question } from '../types';
import { colors, radius, typography } from '../theme';
import { MathText } from './MathText';
import { Input } from './Input';

interface Props {
  question: Question;
  index: number;
  /** Selected option index (MCQ/TF) or essay text */
  value: number | string | null;
  onChange: (value: number | string) => void;
  disabled?: boolean;
}

/** Renders one question with its answer input (MCQ, true/false, or essay). */
export function QuestionCard({ question, index, value, onChange, disabled }: Props) {
  const type = question.type || 'multiple-choice';
  const options: string[] =
    type === 'true-false'
      ? ['صح', 'خطأ']
      : question.options || [];

  const pts = Number(question.points) || 1;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={typography.h3}>سؤال {index + 1}</Text>
        <Text style={typography.caption}>{pts} درجة</Text>
      </View>

      <MathText text={question.text} style={styles.questionText} />

      {question.image ? (
        <Image source={{ uri: question.image }} style={styles.image} resizeMode="contain" />
      ) : null}

      {type === 'essay' ? (
        <Input
          placeholder="اكتب إجابتك هنا..."
          multiline
          numberOfLines={5}
          value={typeof value === 'string' ? value : ''}
          onChangeText={(t) => onChange(t)}
          editable={!disabled}
          style={styles.essayInput}
          maxLength={5000}
        />
      ) : (
        <View style={styles.options}>
          {options.map((opt, i) => {
            const selected = value === i;
            return (
              <Pressable
                key={i}
                disabled={disabled}
                onPress={() => onChange(i)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <View style={[styles.radio, selected && styles.radioSelected]} />
                <View style={styles.optionTextWrap}>
                  <MathText text={opt} fontSize={14} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  questionText: { marginBottom: 10 },
  image: { width: '100%', height: 180, borderRadius: radius.md, marginBottom: 10 },
  options: { gap: 8 },
  option: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: colors.border, backgroundColor: '#fff',
  },
  radioSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionTextWrap: { flex: 1 },
  essayInput: { minHeight: 120, textAlignVertical: 'top' },
});
