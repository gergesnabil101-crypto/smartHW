import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '../../components/Button';
import { colors, radius, typography } from '../../theme';

interface Props {
  quizTitle: string;
  shareUrl: string;
}

/** Share sheet body: QR code + copy link + WhatsApp. Rendered inside a Modal by the caller. */
export function ShareSheet({ quizTitle, shareUrl }: Props) {
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

  return (
    <View style={styles.wrap}>
      <View style={styles.qrBox}>
        <QRCode value={shareUrl} size={200} backgroundColor="#fff" />
      </View>
      <Text style={[typography.caption, styles.url]} numberOfLines={1}>{shareUrl}</Text>
      <View style={styles.row}>
        <Button title="نسخ الرابط" onPress={copy} style={{ flex: 1 }} />
        <Button title="واتساب" variant="secondary" onPress={whatsapp} style={{ flex: 1 }} />
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
