import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Loading, ErrorState } from '../../components/Feedback';
import { getPricing, adminUpdatePricing, PricingConfig } from '../../lib/services';
import { PLANS } from '../../lib/plans';
import { useAuth } from '../../store/AuthContext';
import { colors, typography } from '../../theme';

/** Admin pricing panel: token profit margin (billing multipliers) + per-plan prices. */
export default function AdminPricingScreen() {
  const { user, initialized } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flashMult, setFlashMult] = useState('5');
  const [proMult, setProMult] = useState('7');
  const [flashPrice, setFlashPrice] = useState('200');
  const [proPrice, setProPrice] = useState('250');
  const [planPrices, setPlanPrices] = useState<Record<string, { monthly: string; yearly: string }>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const cfg: PricingConfig = await getPricing();
      if (cfg.flash_output_multiplier != null) setFlashMult(String(cfg.flash_output_multiplier));
      if (cfg.pro_output_multiplier != null) setProMult(String(cfg.pro_output_multiplier));
      if (cfg.flash_price_per_million != null) setFlashPrice(String(cfg.flash_price_per_million));
      if (cfg.pro_price_per_million != null) setProPrice(String(cfg.pro_price_per_million));
      const pp: Record<string, { monthly: string; yearly: string }> = {};
      for (const p of PLANS) {
        const o = cfg.plan_prices?.[p.id];
        pp[p.id] = { monthly: String(o?.monthly ?? p.monthlyPrice), yearly: String(o?.yearly ?? p.yearlyPrice) };
      }
      setPlanPrices(pp);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل إعدادات التسعير.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) load(); }, [user]);

  const save = async () => {
    const num = (s: string) => {
      const n = Number(s);
      return isFinite(n) && n > 0 ? n : null;
    };
    const fm = num(flashMult); const pm = num(proMult);
    const fp = num(flashPrice); const pp = num(proPrice);
    if (!fm || !pm) return Alert.alert('قيمة غير صالحة', 'مضاعف التوكنز يجب أن يكون رقماً موجباً.');
    if (!fp || !pp) return Alert.alert('قيمة غير صالحة', 'سعر المليون يجب أن يكون رقماً موجباً.');
    const prices: Record<string, { monthly?: number; yearly?: number }> = {};
    for (const [id, v] of Object.entries(planPrices)) {
      const m = num(v.monthly); const y = num(v.yearly);
      if (!m || !y) return Alert.alert('قيمة غير صالحة', `راجع أسعار الباقة: ${id}`);
      prices[id] = { monthly: m, yearly: y };
    }
    setSaving(true);
    try {
      await adminUpdatePricing({
        flash_output_multiplier: fm,
        pro_output_multiplier: pm,
        flash_price_per_million: fp,
        pro_price_per_million: pp,
        plan_prices: prices,
      });
      Alert.alert('تم الحفظ', 'تم تحديث إعدادات التسعير وهامش الربح.');
    } catch (e: any) {
      Alert.alert('فشل الحفظ', e?.message || 'حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  if (initialized && !user) return <Redirect href="/(auth)/login" />;
  if (!(user as any)?.isAdmin) {
    return <Screen><ErrorState message="غير مصرح — هذه الصفحة متاحة لمديري المنصة فقط." /></Screen>;
  }

  return (
    <Screen>
      <Text style={[typography.h2, { marginBottom: 4 }]}>⚙️ إعدادات التسعير</Text>
      <Text style={[typography.caption, styles.hint]}>
        مضاعف التوكنز هو هامش الربح: عدد التوكنز المحتسبة على العميل مقابل كل توكن يستهلكه النموذج فعلياً.
      </Text>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <Card>
            <Text style={typography.h3}>🪙 هامش ربح التوكنز</Text>
            <Input label="مضاعف فلاش (توكنز محتسبة لكل توكن فعلي)" value={flashMult} onChangeText={setFlashMult} keyboardType="decimal-pad" />
            <Input label="مضاعف برو" value={proMult} onChangeText={setProMult} keyboardType="decimal-pad" />
          </Card>
          <Card>
            <Text style={typography.h3}>💵 سعر المليون توكن (جنيه)</Text>
            <Input label="سعر مليون توكن — فلاش" value={flashPrice} onChangeText={setFlashPrice} keyboardType="decimal-pad" />
            <Input label="سعر مليون توكن — برو" value={proPrice} onChangeText={setProPrice} keyboardType="decimal-pad" />
          </Card>
          <Card>
            <Text style={typography.h3}>📦 أسعار الباقات (شهري / سنوي)</Text>
            {PLANS.map((p) => (
              <View key={p.id} style={styles.planRow}>
                <Text style={styles.planName} numberOfLines={1}>{p.name}</Text>
                <View style={styles.planInputs}>
                  <Input
                    label="شهري"
                    value={planPrices[p.id]?.monthly ?? String(p.monthlyPrice)}
                    onChangeText={(t) => setPlanPrices((s) => ({ ...s, [p.id]: { ...(s[p.id] || { yearly: String(p.yearlyPrice) }), monthly: t } }))}
                    keyboardType="decimal-pad"
                    style={styles.planInput}
                  />
                  <Input
                    label="سنوي"
                    value={planPrices[p.id]?.yearly ?? String(p.yearlyPrice)}
                    onChangeText={(t) => setPlanPrices((s) => ({ ...s, [p.id]: { ...(s[p.id] || { monthly: String(p.monthlyPrice) }), yearly: t } }))}
                    keyboardType="decimal-pad"
                    style={styles.planInput}
                  />
                </View>
              </View>
            ))}
          </Card>
          <Button title={saving ? 'جاري الحفظ...' : '💾 حفظ إعدادات التسعير'} onPress={save} loading={saving} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { marginBottom: 12, writingDirection: 'rtl', textAlign: 'right' },
  planRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 10 },
  planName: { ...typography.label, marginBottom: 4 },
  planInputs: { flexDirection: 'row-reverse', gap: 10 },
  planInput: { flex: 1 },
});
