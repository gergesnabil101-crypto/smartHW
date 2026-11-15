import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import type { Question } from '../../types';
import { colors, radius, typography } from '../../theme';

const MAX_IMAGE_CHARS = 700_000;   // ~500KB image — keeps quiz doc under Firestore's 1MB limit
const MAX_AUDIO_CHARS = 900_000;   // ~650KB audio clip

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
  const [image, setImage] = useState<string | undefined>(initial.image);
  const [audio, setAudio] = useState<string | undefined>(initial.audio);
  const [audioName, setAudioName] = useState('');
  const [error, setError] = useState('');

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.45, base64: true });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const a = res.assets[0];
    const dataUrl = `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}`;
    if (dataUrl.length > MAX_IMAGE_CHARS) {
      return Alert.alert('الصورة كبيرة جداً', 'اختر صورة أصغر — السؤال يُحفظ داخل قاعدة البيانات.');
    }
    setImage(dataUrl);
  };

  const pickAudio = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const b64 = await FileSystem.readAsStringAsync(a.uri, { encoding: 'base64' });
      const mime = a.mimeType || 'audio/mpeg';
      const dataUrl = `data:${mime};base64,${b64}`;
      if (dataUrl.length > MAX_AUDIO_CHARS) {
        return Alert.alert('الملف كبير جداً', 'اختر مقطعاً صوتياً قصيراً (أقل من ~500KB تقريباً).');
      }
      setAudio(dataUrl);
      setAudioName(a.name || 'مقطع صوتي');
    } catch {
      Alert.alert('تعذر إرفاق الملف', 'حاول مرة أخرى.');
    }
  };

  const save = () => {
    if (!text.trim() && !image) return setError('نص السؤال أو صورة السؤال مطلوبة.');
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
        image,
        audio,
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
      image,
      audio,
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

      {/* Question attachments — an image can carry the whole question (e.g. a
          diagram or scanned question); audio plays inside the student's exam. */}
      <View style={styles.attachRow}>
        <Pressable onPress={pickImage} style={styles.attachBtn}>
          <Text style={styles.attachBtnText}>📷 {image ? 'تغيير الصورة' : 'صورة مع السؤال'}</Text>
        </Pressable>
        <Pressable onPress={pickAudio} style={styles.attachBtn}>
          <Text style={styles.attachBtnText}>🎤 {audio ? 'تغيير الصوت' : 'ملف صوتي'}</Text>
        </Pressable>
      </View>
      {image ? (
        <View style={styles.attachPreview}>
          <Image source={{ uri: image }} style={styles.attachImg} resizeMode="contain" />
          <Pressable onPress={() => setImage(undefined)} style={styles.attachRemove}>
            <Text style={styles.attachRemoveText}>إزالة الصورة ✕</Text>
          </Pressable>
        </View>
      ) : null}
      {audio ? (
        <View style={styles.attachPreview}>
          <Text style={styles.audioLabel}>🔊 {audioName || 'مقطع صوتي مرفق'}</Text>
          <Pressable onPress={() => { setAudio(undefined); setAudioName(''); }} style={styles.attachRemove}>
            <Text style={styles.attachRemoveText}>إزالة الصوت ✕</Text>
          </Pressable>
        </View>
      ) : null}

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
  attachRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 10 },
  attachBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surfaceTint },
  attachBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  attachPreview: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10, backgroundColor: colors.surfaceTint, borderRadius: radius.md, padding: 8 },
  attachImg: { width: 90, height: 70, borderRadius: radius.sm },
  attachRemove: { paddingHorizontal: 8, paddingVertical: 6 },
  attachRemoveText: { fontSize: 12, fontWeight: '700', color: colors.danger },
  audioLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'right' },
});
