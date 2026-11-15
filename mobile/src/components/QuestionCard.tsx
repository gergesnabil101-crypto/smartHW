import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import type { Question } from '../types';
import { colors, radius, typography } from '../theme';
import { MathText } from './MathText';
import { Input } from './Input';

/** Plays a question's attached audio clip (data URL → cache file → player). */
function AudioAttachment({ dataUrl, qid }: { dataUrl: string; qid: string }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
        if (!m) return;
        const ext = /m4a|mp4|aac/.test(m[1]) ? 'm4a' : /wav/.test(m[1]) ? 'wav' : /ogg|opus/.test(m[1]) ? 'ogg' : 'mp3';
        const uri = `${FileSystem.cacheDirectory}qaudio_${qid}.${ext}`;
        await FileSystem.writeAsStringAsync(uri, m[2], { encoding: 'base64' });
        if (alive) {
          player.replace({ uri });
          setReady(true);
        }
      } catch { /* audio is optional — ignore */ }
    })();
    return () => { alive = false; try { player.pause(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUrl, qid]);

  const playing = status.playing;
  return (
    <Pressable
      disabled={!ready}
      onPress={() => { if (playing) player.pause(); else { player.seekTo(0); player.play(); } }}
      style={styles.audioBtn}
    >
      <Text style={styles.audioBtnText}>{playing ? '⏸ إيقاف الصوت' : ready ? '▶ تشغيل المقطع الصوتي' : '⏳ جاري تجهيز الصوت...'}</Text>
    </Pressable>
  );
}

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

      {question.audio ? <AudioAttachment dataUrl={question.audio} qid={question.id} /> : null}

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
  audioBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surfaceTint, marginBottom: 10 },
  audioBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
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
