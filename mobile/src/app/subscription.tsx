import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { doc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { useAuth } from '../store/AuthContext';
import { db } from '../lib/firebase';
import { getPricing } from '../lib/services';
import { PLANS, PLAN_GROUPS, type PlanOption } from '../lib/plans';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Loading } from '../components/Feedback';
import { colors, radius, typography } from '../theme';

const SUPPORT_PHONE = '201063124503';
const MAX_RECEIPT_CHARS = 2_900_000;
// 'iap' = Google Play Billing only (store-compliant). 'manual' = receipt upload
// flow used on the web. Controlled via expo.extra.paymentsMode in app.json.
const PAYMENTS_MODE = (Constants.expoConfig?.extra as any)?.paymentsMode === 'manual' ? 'manual' : 'iap';

export default function SubscriptionScreen() {
  const { initialized, user, profile, refreshProfile } = useAuth();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selected, setSelected] = useState<PlanOption | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null); // data URL
  const [submitting, setSubmitting] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [pricePerMillion, setPricePerMillion] = useState({ flash: 200, pro: 250 });

  useEffect(() => {
    if (PAYMENTS_MODE !== 'manual') return;
    getPricing()
      .then((cfg) => setPricePerMillion({
        flash: Number(cfg?.flash_price_per_million) > 0 ? Number(cfg.flash_price_per_million) : 200,
        pro: Number(cfg?.pro_price_per_million) > 0 ? Number(cfg.pro_price_per_million) : 250,
      }))
      .catch(() => {});
  }, []);

  const price = useMemo(
    () => (p: PlanOption) => (cycle === 'monthly' ? p.monthlyPrice : p.yearlyPrice),
    [cycle]
  );

  const MILLION = 1_000_000;
  const isPro = profile?.preferred_ai_model === 'pro' || (profile?.preferred_ai_model as any) === 'gemini_pro' || String(profile?.subscription_type || '').startsWith('pro_');

  // Remaining-token upgrade cost — mirrors web calculateProUpgradeCost()
  const upgradeCalc = useMemo(() => {
    const p: any = profile || {};
    let limit = Number(p.tokens_limit || p.token_balance || p.total_tokens || 0) || 0;
    if (!limit && Number(p.custom_tokens_millions) > 0) limit = Number(p.custom_tokens_millions) * MILLION;
    if (!limit) {
      const plan = PLANS.find((pl) => pl.id === p.subscription_type || pl.id === p.subscriptionPlan);
      if (plan) {
        const n = plan.id.match(/(\d+(?:\.\d+)?)\s*M/i);
        limit = n ? parseFloat(n[1]) * MILLION : MILLION;
      } else {
        const m = String(p.subscription_type || '').match(/(\d+(?:\.\d+)?)\s*[mM]/);
        limit = m ? parseFloat(m[1]) * MILLION : MILLION;
      }
      if (String(p.billing_cycle || '') === 'yearly' && limit < 10 * MILLION) limit *= 12;
    }
    const totalLimit = limit + Math.max(0, Number(p.extra_tokens) || 0);
    const used = Math.max(0, Number(p.tokens_used) || 0);
    const remaining = Math.max(0, totalLimit - used);
    const excess = Math.max(0, used - totalLimit);
    const diffPerMillion = Math.max(0, pricePerMillion.pro - pricePerMillion.flash);

    let upgradeCost = 0;
    if (remaining > 0) {
      upgradeCost = remaining <= MILLION ? diffPerMillion : Math.round((remaining / MILLION) * diffPerMillion);
    }
    const excessCost = excess > 0 ? Math.round((excess / MILLION) * pricePerMillion.flash) : 0;
    let total = upgradeCost + excessCost;
    if (total === 0 && remaining === 0) total = pricePerMillion.pro;
    return { totalLimit, used, remaining, excess, diffPerMillion, upgradeCost, excessCost, total };
  }, [profile, pricePerMillion]);

  if (!initialized) return <Screen><Loading /></Screen>;
  if (!user) return <Redirect href="/(auth)/login" />;

  const pickReceipt = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const asset = res.assets[0];
    const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
    if (dataUrl.length > MAX_RECEIPT_CHARS) {
      return Alert.alert('الصورة كبيرة جداً', 'اختر صورة أوضح وأصغر (لقطة شاشة للإيصال تكفي).');
    }
    setReceipt(dataUrl);
  };

  const submitRequest = async () => {
    if (!selected || !user?.uid) return;
    if (!receipt) return Alert.alert('صورة الإيصال مطلوبة', 'ارفع صورة إيصال الدفع ليتم مراجعة طلبك وتفعيل اشتراكك.');
    setSubmitting(true);
    try {
      const ref = doc(collection(db, 'subscription_requests'));
      await setDoc(ref, {
        id: ref.id,
        user_id: user.uid,
        user_name: profile?.name || user.displayName || '',
        user_email: user.email || '',
        user_phone: profile?.phone || '',
        user_subject: profile?.subject || '',
        plan: selected.id,
        billing_cycle: cycle,
        screenshot_data: receipt,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'users', user.uid), { hasPendingSubscription: true }).catch(() => {});
      setSelected(null);
      setReceipt(null);
      refreshProfile?.().catch(() => {});
      Alert.alert('تم إرسال الطلب ✅', 'وصلنا طلب اشتراكك وصورة الإيصال. سيتم مراجعة الدفع وتفعيل حسابك قريباً.');
    } catch (e: any) {
      Alert.alert('فشل إرسال الطلب', e?.message || 'تأكد من الاتصال وحاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitUpgrade = async () => {
    if (!user?.uid) return;
    if (!receipt) return Alert.alert('صورة الإيصال مطلوبة', 'ارفع صورة إيصال دفع فارق الترقية ليتم مراجعتها وتفعيل نظام برو.');
    setSubmitting(true);
    try {
      const ref = doc(collection(db, 'subscription_requests'));
      await setDoc(ref, {
        id: ref.id,
        user_id: user.uid,
        user_name: profile?.name || user.displayName || '',
        user_email: user.email || '',
        user_phone: profile?.phone || '',
        user_subject: profile?.subject || '',
        plan: 'upgrade_to_pro',
        billing_cycle: 'monthly',
        custom_details: JSON.stringify({
          type: 'upgrade_to_pro',
          plan_name: 'ترقية إلى نظام جيميناي برو (Gemini Pro)',
          target_model: 'gemini_pro',
          amount_egp: upgradeCalc.total,
          upgrade_difference_cost: upgradeCalc.total,
          remaining_tokens_at_upgrade: upgradeCalc.remaining,
          excess_tokens_at_upgrade: upgradeCalc.excess,
        }),
        screenshot_data: receipt,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'users', user.uid), { hasPendingSubscription: true }).catch(() => {});
      setUpgradeOpen(false);
      setReceipt(null);
      refreshProfile?.().catch(() => {});
      Alert.alert('تم إرسال طلب الترقية ✅', `وصلنا طلب الترقية إلى برو وإيصال فارق السعر بمبلغ ${upgradeCalc.total} ج.م. سيتم تفعيل نظام برو لحسابك فور مراجعة الدفع.`);
    } catch (e: any) {
      Alert.alert('فشل إرسال الطلب', e?.message || 'تأكد من الاتصال وحاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  const askWhatsApp = () => {
    const msg = `مرحباً، أريد الاشتراك/التجديد في مصحح الواجبات الذكي.\nالاسم: ${profile?.name || ''}\nالبريد: ${user?.email || ''}`;
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(msg)}`).catch(() => {});
  };

  return (
    <Screen>
      {/* Billing cycle toggle */}
      <View style={styles.cycleRow}>
        {(['monthly', 'yearly'] as const).map((c) => (
          <Pressable key={c} onPress={() => setCycle(c)} style={[styles.cycleChip, cycle === c && styles.cycleChipOn]}>
            <Text style={[styles.cycleText, cycle === c && styles.cycleTextOn]}>
              {c === 'monthly' ? 'شهري' : 'سنوي (شهرين مجاناً)'}
            </Text>
          </Pressable>
        ))}
      </View>

      {PAYMENTS_MODE === 'manual' && !isPro && profile?.hasAccess !== false ? (
        <Card style={styles.upgradeCard}>
          <Text style={styles.upgradeTitle}>👑 ترقية إلى نظام برو (Gemini Pro)</Text>
          <Text style={styles.upgradeLine}>
            النموذج الحالي: فلاش ⚡ • التوكنز المتبقية: {upgradeCalc.remaining.toLocaleString('en')}
          </Text>
          <Text style={styles.upgradeLine}>
            {upgradeCalc.remaining > 0
              ? `ادفع فارق السعر فقط على رصيدك المتبقي (${upgradeCalc.diffPerMillion} ج.م لكل مليون توكن): ${upgradeCalc.upgradeCost} ج.م`
              : `رصيدك منتهٍ — فعّل باقة برو جديدة (1 مليون توكن): ${upgradeCalc.total} ج.م`}
            {upgradeCalc.excessCost > 0 ? ` + تسوية تجاوز ${upgradeCalc.excess.toLocaleString('en')} توكن: ${upgradeCalc.excessCost} ج.م` : ''}
          </Text>
          {profile?.hasPendingSubscription ? (
            <Text style={styles.upgradePending}>⏳ لديك طلب اشتراك قيد المراجعة بالفعل</Text>
          ) : (
            <Pressable onPress={() => { setReceipt(null); setUpgradeOpen(true); }} style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>🚀 ترقية الآن بفارق {upgradeCalc.total} ج.م</Text>
            </Pressable>
          )}
        </Card>
      ) : null}

      {PLAN_GROUPS.map((g) => (
        <View key={g.key}>
          <Text style={[typography.h3, styles.groupTitle]}>{g.title}</Text>
          {PLANS.filter((p) => p.group === g.key).map((p) => (
            <Card key={p.id} onPress={() => setSelected(p)} style={p.popular ? styles.popularCard : undefined}>
              <View style={styles.planHead}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3}>
                    {p.name}{p.popular ? ' ⭐' : ''}
                  </Text>
                  <Text style={[typography.caption, { textAlign: 'right' }]}>
                    {p.features.slice(0, 2).join(' • ')}
                  </Text>
                </View>
                <View style={styles.priceBox}>
                  <Text style={styles.priceNum}>{price(p)}</Text>
                  <Text style={styles.priceUnit}>ج.م / {cycle === 'monthly' ? 'شهر' : 'سنة'}</Text>
                </View>
              </View>
              <Pressable onPress={() => setSelected(p)} style={styles.subscribeBtn}>
                <Text style={styles.subscribeText}>اشترك الآن</Text>
              </Pressable>
            </Card>
          ))}
        </View>
      ))}

      <Pressable onPress={askWhatsApp} style={styles.waRow}>
        <Text style={styles.waText}>💬 محتاج مساعدة في الاختيار؟ كلمنا واتساب</Text>
      </Pressable>

      {/* Subscribe / payment sheet */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={typography.h2}>{selected?.name}</Text>
              <Text style={styles.modalPrice}>
                {selected ? price(selected) : 0} ج.م / {cycle === 'monthly' ? 'شهر' : 'سنة'}
              </Text>
              {selected?.features.map((f, i) => (
                <Text key={i} style={styles.feature}>• {f}</Text>
              ))}
              {PAYMENTS_MODE === 'iap' ? (
                <>
                  <Text style={styles.payHint}>
                    الاشتراك يتم عبر Google Play داخل التطبيق — سيتم تفعيل الدفع فور إتاحة منتجات الاشتراك على المتجر. للاستفسار أو الحالات الخاصة تواصل معنا على واتساب.
                  </Text>
                  <Button title="💳 اشترك عبر Google Play" onPress={() => Alert.alert('الاشتراك عبر Google Play', 'سيتم تفعيل الشراء داخل التطبيق مع نشر منتجات الاشتراك على Play Console. للتفعيل الفوري تواصل مع الإدارة عبر واتساب.', [
                    { text: 'حسناً', style: 'cancel' },
                    { text: 'واتساب', onPress: askWhatsApp },
                  ])} />
                </>
              ) : (
                <>
                  <Text style={styles.payHint}>
                    حوّل المبلغ على فودافون كاش / إنستاباي على الرقم المعتمد من الإدارة، ثم ارفع صورة الإيصال وسيتم تفعيل اشتراكك بعد المراجعة.
                  </Text>
                  {receipt ? (
                    <Image source={{ uri: receipt }} style={styles.receiptImg} resizeMode="cover" />
                  ) : null}
                  <Button title={receipt ? '📷 تغيير صورة الإيصال' : '📷 رفع صورة الإيصال'} variant="secondary" onPress={pickReceipt} />
                  <View style={{ height: 8 }} />
                  <Button title={submitting ? 'جاري الإرسال...' : '✅ إرسال طلب الاشتراك'} onPress={submitRequest} loading={submitting} />
                </>
              )}
              <View style={{ height: 8 }} />
              <Button title="إلغاء" variant="secondary" onPress={() => { setSelected(null); setReceipt(null); }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Pro upgrade payment sheet */}
      <Modal visible={upgradeOpen} transparent animationType="slide" onRequestClose={() => setUpgradeOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={typography.h2}>👑 ترقية إلى نظام برو</Text>
              <Text style={styles.modalPrice}>{upgradeCalc.total} ج.م — دفعة واحدة</Text>
              <Text style={styles.feature}>• الرصيد المتبقي: {upgradeCalc.remaining.toLocaleString('en')} توكن</Text>
              <Text style={styles.feature}>• فارق الترقية: {upgradeCalc.upgradeCost} ج.م ({upgradeCalc.diffPerMillion} ج.م/مليون)</Text>
              {upgradeCalc.excessCost > 0 ? (
                <Text style={styles.feature}>• تسوية تجاوز: {upgradeCalc.excessCost} ج.م</Text>
              ) : null}
              <Text style={styles.feature}>• يتحول حسابك لنموذج برو فور تفعيل الإدارة للدفعة</Text>
              <Text style={styles.payHint}>
                حوّل فارق الترقية على فودافون كاش / إنستاباي على الرقم المعتمد من الإدارة، ثم ارفع صورة الإيصال وسيتم تحويل نظامك إلى برو بعد المراجعة.
              </Text>
              {receipt ? (
                <Image source={{ uri: receipt }} style={styles.receiptImg} resizeMode="cover" />
              ) : null}
              <Button title={receipt ? '📷 تغيير صورة الإيصال' : '📷 رفع صورة الإيصال'} variant="secondary" onPress={pickReceipt} />
              <View style={{ height: 8 }} />
              <Button title={submitting ? 'جاري الإرسال...' : '✅ إرسال طلب الترقية'} onPress={submitUpgrade} loading={submitting} />
              <View style={{ height: 8 }} />
              <Button title="إلغاء" variant="secondary" onPress={() => { setUpgradeOpen(false); setReceipt(null); }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cycleRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 14 },
  cycleChip: { flex: 1, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  cycleChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  cycleText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  cycleTextOn: { color: '#fff' },
  groupTitle: { marginTop: 10, marginBottom: 8, textAlign: 'right' },
  popularCard: { borderWidth: 2, borderColor: colors.primary },
  planHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  priceBox: { alignItems: 'center', minWidth: 70 },
  priceNum: { fontSize: 22, fontWeight: '900', color: colors.primary },
  priceUnit: { fontSize: 10, color: colors.textMuted },
  subscribeBtn: { marginTop: 10, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 9, alignItems: 'center' },
  subscribeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  upgradeCard: { borderWidth: 2, borderColor: colors.warning, marginBottom: 14, backgroundColor: colors.warningSoft },
  upgradeTitle: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'right', marginBottom: 6 },
  upgradeLine: { fontSize: 13, color: colors.textSecondary, textAlign: 'right', marginTop: 4, lineHeight: 19 },
  upgradePending: { marginTop: 10, fontSize: 13, fontWeight: '700', color: colors.warning, textAlign: 'right' },
  upgradeBtn: { marginTop: 10, backgroundColor: colors.warning, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  upgradeBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  waRow: { marginTop: 16, marginBottom: 24, alignItems: 'center' },
  waText: { color: colors.success, fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 20, maxHeight: '88%' },
  modalPrice: { fontSize: 20, fontWeight: '900', color: colors.primary, textAlign: 'right', marginTop: 4 },
  feature: { fontSize: 13, color: colors.textSecondary, textAlign: 'right', marginTop: 6 },
  payHint: { fontSize: 12, color: colors.textMuted, textAlign: 'right', marginVertical: 12, lineHeight: 18 },
  receiptImg: { width: '100%', height: 180, borderRadius: radius.md, marginBottom: 12, backgroundColor: colors.border },
});
