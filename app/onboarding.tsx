import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PageHeader, PrimaryButton, SadieAvatar, SecondaryButton, SectionCard, VelvetScreen } from "@/components/holdoff-ui";
import { useHoldOff } from "@/components/holdoff-provider";
import { APP_COPY, HOLD_OFF } from "@/constants/holdoff-theme";
import { Redirect } from "expo-router";

const STEPS = ["Welcome", "Age", "Capabilities", "Support", "Consent", "Contact", "Sadie"];

function CheckRow({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}><View style={[styles.box, checked && styles.boxSelected]}><Text style={styles.boxText}>{checked ? "✓" : ""}</Text></View><Text style={styles.checkText}>{label}</Text></Pressable>;
}

export default function OnboardingScreen() {
  const { store, updateOnboarding, completeOnboarding } = useHoldOff();
  const step = store.onboarding.step;
  const [ageUnder, setAgeUnder] = useState(false);
  const [contactName, setContactName] = useState(store.onboarding.trustedContact?.name ?? "");
  const [contactMethod, setContactMethod] = useState(store.onboarding.trustedContact?.method ?? "");
  const canContinue = useMemo(() => {
    if (step === 1) return store.onboarding.ageConfirmed && !ageUnder;
    if (step === 2) return store.onboarding.capabilityAcknowledged;
    if (step === 3) return store.onboarding.supportAcknowledged;
    if (step === 4) return store.onboarding.analysisConsent;
    return true;
  }, [ageUnder, step, store.onboarding.ageConfirmed, store.onboarding.analysisConsent, store.onboarding.capabilityAcknowledged, store.onboarding.supportAcknowledged]);
  if (store.onboarding.completed) return <Redirect href="/" />;

  const advance = () => {
    if (step === 5 && (contactName.trim() || contactMethod.trim())) updateOnboarding({ trustedContact: { name: contactName.trim() || "Someone you trust", method: contactMethod.trim() } });
    if (step === 6) return completeOnboarding();
    updateOnboarding({ step: step + 1 });
  };
  const goBack = () => { if (step > 0) updateOnboarding({ step: step - 1 }); };

  const content = () => {
    switch (step) {
      case 0:
        return <><View style={styles.welcomeMark}><View style={styles.moonHalo}><Text style={styles.moonText}>⌁</Text></View></View><Text style={styles.welcomeTitle}>Hold a little space before you answer.</Text><Text style={styles.welcomeQuote}>“The opposite of addiction is connection.”</Text><Text style={styles.body}>HoldOff helps you pause with a message, find the words that feel truer, and stay close to the people who matter.</Text></>;
      case 1:
        return <><PageHeader eyebrow="A gentle boundary" title="A quick age check" subtitle="HoldOff is for people who are 13 or older." /><SectionCard><CheckRow checked={store.onboarding.ageConfirmed && !ageUnder} label="I confirm that I’m 13 or older." onPress={() => { setAgeUnder(false); updateOnboarding({ ageConfirmed: !store.onboarding.ageConfirmed || ageUnder }); }} /><CheckRow checked={ageUnder} label="I’m under 13." onPress={() => { setAgeUnder(true); updateOnboarding({ ageConfirmed: false }); }} />{ageUnder ? <Text style={styles.kindNotice}>Thanks for being honest. HoldOff isn’t available for you yet. Please talk with a trusted adult about support that fits you.</Text> : null}</SectionCard></>;
      case 2:
        return <><PageHeader eyebrow="Plain language, always" title="What HoldOff can do" subtitle="No hidden access. No overclaiming." /><SectionCard><Text style={styles.body}>{APP_COPY.capability}</Text><View style={styles.rule} /><CheckRow checked={store.onboarding.capabilityAcknowledged} label="I understand what this app can and can’t access." onPress={() => updateOnboarding({ capabilityAcknowledged: !store.onboarding.capabilityAcknowledged })} /></SectionCard></>;
      case 3:
        return <><PageHeader eyebrow="A supportive tool" title="Not therapy — still here with you" /><SectionCard><Text style={styles.body}>{APP_COPY.supportBoundary}</Text><View style={styles.crisisBox}><Text style={styles.crisisTitle}>If you’re in crisis</Text><Text style={styles.crisisText}>Call or text <Text style={styles.crisisStrong}>988</Text> in the US for the Suicide & Crisis Lifeline.</Text></View><CheckRow checked={store.onboarding.supportAcknowledged} label="I understand this support boundary." onPress={() => updateOnboarding({ supportAcknowledged: !store.onboarding.supportAcknowledged })} /></SectionCard></>;
      case 4:
        return <><PageHeader eyebrow="Your choice" title="Choose what Sadie can learn" subtitle="You can change either choice anytime in Settings." /><SectionCard><CheckRow checked={store.onboarding.analysisConsent} label="I opt in to AI analysis of drafts or conversation history I explicitly submit." onPress={() => updateOnboarding({ analysisConsent: !store.onboarding.analysisConsent })} /><Text style={styles.smallText}>Sadie never scans messages in the background. Before a thread analysis, HoldOff shows which local messages would be included.</Text><View style={styles.rule} /><CheckRow checked={store.onboarding.moodLearningConsent} label="Let HoldOff learn writing-based mood patterns over time. Optional." onPress={() => updateOnboarding({ moodLearningConsent: !store.onboarding.moodLearningConsent })} /><Text style={styles.smallText}>Mood is inferred from your writing — HoldOff never asks you to rate it.</Text></SectionCard></>;
      case 5:
        return <><PageHeader eyebrow="Optional, always" title="Someone in your corner" subtitle="Sadie may suggest reaching out. HoldOff never contacts them unless you later enable the separate trusted-contact support setting." /><SectionCard><Text style={styles.inputLabel}>Their name</Text><TextInput value={contactName} onChangeText={setContactName} placeholder="Name" placeholderTextColor={HOLD_OFF.muted} style={styles.input} /><Text style={styles.inputLabel}>Phone or email</Text><TextInput value={contactMethod} onChangeText={setContactMethod} placeholder="Phone or email" placeholderTextColor={HOLD_OFF.muted} style={styles.input} keyboardType="email-address" autoCapitalize="none" /><Text style={styles.smallText}>You can leave both fields blank and add someone later.</Text></SectionCard></>;
      default:
        return <View style={styles.meetSadie}><SadieAvatar expression="encouraging" /><Text style={styles.meetTitle}>Hi, I’m Sadie.</Text><Text style={styles.body}>I’ll notice the edge in a draft without judging you. We can slow it down, look for what you really mean, and leave every decision in your hands.</Text><SectionCard style={styles.meetCard}><Text style={styles.meetCardText}>Your words stay yours. I’m here for the pause between feeling and sending.</Text></SectionCard></View>;
    }
  };

  return <VelvetScreen><KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={styles.flex}><ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><View style={styles.topBar}><Text style={styles.stepText}>{step + 1} of {STEPS.length}</Text><View style={styles.dots}>{STEPS.map((item, index) => <View key={item} style={[styles.dot, index <= step && styles.dotActive]} />)}</View></View><View style={styles.center}>{content()}</View></ScrollView><View style={styles.actions}>{step > 0 ? <SecondaryButton label="Back" compact onPress={goBack} /> : null}<View style={step > 0 ? styles.actionGrow : styles.actionFull}><PrimaryButton label={step === 6 ? "Begin with Sadie" : "Continue"} onPress={advance} disabled={!canContinue} /></View></View></KeyboardAvoidingView></VelvetScreen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, scroll: { flexGrow: 1, paddingTop: 20, paddingBottom: 18 }, topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 30 }, stepText: { color: HOLD_OFF.muted, fontSize: 13, lineHeight: 18, fontWeight: "700" }, dots: { flexDirection: "row", gap: 5 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: HOLD_OFF.border }, dotActive: { backgroundColor: HOLD_OFF.lavender, width: 18 }, center: { flex: 1, justifyContent: "center" }, welcomeMark: { alignItems: "center", marginBottom: 29, marginTop: 32 }, moonHalo: { width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(184,166,240,0.14)", borderWidth: 1, borderColor: "rgba(184,166,240,0.35)", alignItems: "center", justifyContent: "center" }, moonText: { color: HOLD_OFF.lavender, fontSize: 58, lineHeight: 62, fontWeight: "300" }, welcomeTitle: { color: HOLD_OFF.text, textAlign: "center", fontSize: 33, lineHeight: 41, letterSpacing: -0.8, fontWeight: "700" }, welcomeQuote: { color: HOLD_OFF.lavender, textAlign: "center", fontSize: 17, lineHeight: 25, fontStyle: "italic", marginTop: 20 }, body: { color: HOLD_OFF.muted, fontSize: 16, lineHeight: 25, marginTop: 20 }, checkRow: { flexDirection: "row", gap: 13, alignItems: "center", minHeight: 54, paddingVertical: 7 }, box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: HOLD_OFF.lavender, alignItems: "center", justifyContent: "center" }, boxSelected: { backgroundColor: HOLD_OFF.violet, borderColor: HOLD_OFF.violet }, boxText: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 17, fontWeight: "800" }, checkText: { flex: 1, color: HOLD_OFF.text, fontSize: 15, lineHeight: 22 }, kindNotice: { color: HOLD_OFF.gold, fontSize: 14, lineHeight: 21, marginTop: 13 }, rule: { height: 1, backgroundColor: HOLD_OFF.border, marginVertical: 7 }, crisisBox: { padding: 14, borderRadius: 15, backgroundColor: "rgba(184,166,240,0.11)", borderWidth: 1, borderColor: "rgba(184,166,240,0.28)", marginTop: 18, marginBottom: 10 }, crisisTitle: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 20, fontWeight: "700" }, crisisText: { color: HOLD_OFF.muted, fontSize: 14, lineHeight: 21, marginTop: 4 }, crisisStrong: { color: HOLD_OFF.lavender, fontWeight: "800" }, smallText: { color: HOLD_OFF.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }, inputLabel: { color: HOLD_OFF.moon, fontSize: 13, lineHeight: 18, fontWeight: "700", marginBottom: 7, marginTop: 5 }, input: { color: HOLD_OFF.text, borderWidth: 1, borderColor: HOLD_OFF.border, backgroundColor: "#2A1A4A", minHeight: 48, borderRadius: 14, fontSize: 16, paddingHorizontal: 13, marginBottom: 13 }, meetSadie: { alignItems: "center", paddingTop: 22 }, meetTitle: { color: HOLD_OFF.text, fontSize: 30, lineHeight: 38, fontWeight: "700", marginTop: 20 }, meetCard: { width: "100%", marginTop: 22 }, meetCardText: { color: HOLD_OFF.lavender, fontSize: 15, lineHeight: 23, fontStyle: "italic" }, actions: { flexDirection: "row", gap: 10, paddingBottom: 10 }, actionGrow: { flex: 1 }, actionFull: { width: "100%" }, pressed: { transform: [{ scale: 0.98 }], opacity: 0.85 },
});
