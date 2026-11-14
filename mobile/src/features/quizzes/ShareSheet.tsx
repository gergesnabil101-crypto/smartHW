import React, { useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '../../components/Button';
import { colors, radius, typography } from '../../theme';

interface Props {
  quizTitle: string;
  shareUrl: string;
}

/** Share sheet body: QR code + copy link + WhatsApp. Rendered inside a Modal by the caller. */
export function ShareSheet({ quizTitle, shareUrl }: Props) {
  const qrRef = useRef<any>(null);
  const [saving, setSaving] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert('تم النسخ', 'تم نسخ رابط الاختبار — أرسله لطلابك.');
  };

  const whatsapp = () => {
    const msg = `مرحباً 👋\nاختبار جديد: ${quizTitle}\nافتح الرابط لبدء الاختبار:\n${shareUrl}`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert('خطأ', 'تعذر فتح واتساب.')
    );
  };

  const downloadQr = () => {
    if (!qrRef.current?.toDataURL) return;
    setSaving(true);
    qrRef.current.toDataURL(async (data: string) => {
      try {
        const path = `${FileSystem.cacheDirectory}quiz-qr-${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(path, data, { encoding: 'base64' });
        // Save straight to the device gallery — fall back to the share sheet if denied.
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (perm.granted) {
          await MediaLibrary.saveToLibraryAsync(path);
          Alert.alert('تم التحميل ✅', 'تم حفظ رمز QR في معرض الصور على جهازك.');
        } else if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, { mimeType: 'image/png', dialogTitle: 'حفظ رمز QR للاختبار' });
        } else {
          Alert.alert('تعذر الحفظ', 'امنح التطبيق إذن الوصول للصور من إعدادات الجهاز.');
        }
      } catch (e: any) {
        Alert.alert('فشل حفظ QR', e?.message || 'حاول مرة أخرى.');
      } finally {
        setSaving(false);
      }
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.qrBox}>
        <QRCode value={shareUrl} size={200} backgroundColor="#fff" getRef={(c) => { qrRef.current = c; }} />
      </View>
      <Text style={[typography.caption, styles.url]} numberOfLines={1}>{shareUrl}</Text>
      <View style={styles.row}>
        <Button title="نسخ الرابط" onPress={copy} style={{ flex: 1 }} />
        <Button title="واتساب" variant="secondary" onPress={whatsapp} style={{ flex: 1 }} />
      </View>
      <View style={styles.row}>
        <Button title={saving ? 'جاري الحفظ...' : '⬇ تحميل QR'} variant="secondary" onPress={downloadQr} loading={saving} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12 },
  qrBox: { padding: 16, backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  url: { maxWidth: '90%' },
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
});
