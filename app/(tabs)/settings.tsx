import { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { PageHeader, PrimaryButton, SadieAssistant, SecondaryButton, SectionCard, VelvetScreen } from "@/components/holdoff-ui";
import { useHoldOff } from "@/components/holdoff-provider";
import { APP_COPY, HOLD_OFF } from "@/constants/holdoff-theme";

function ToggleRow({ label, description, value, onPress, tag }: { label: string; description: string; value: boolean; onPress: () => void; tag?: string }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={onPress} style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}><View style={styles.toggleCopy}><View style={styles.labelLine}><Text style={styles.toggleLabel}>{label}</Text>{tag ? <View style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View> : null}</View><Text style={styles.toggleDescription}>{description}</Text></View><View style={[styles.toggle, value && styles.toggleOn]}><View style={[styles.toggleKnob, value && styles.toggleKnobOn]} /></View></Pressable>;
}

export default function SettingsScreen() {
  const { store, updatePreferences, updateOnboarding, setTrustedContact, updateSpiralLock, exportJson, deleteEverything } = useHoldOff();
  const router = useRouter();
  const [contactName, setContactName] = useState(store.onboarding.trustedContact?.name ?? "");
  const [contactMethod, setContactMethod] = useState(store.onboarding.trustedContact?.method ?? "");
  const [alcoholHours, setAlcoholHours] = useState(store.preferences.launchConditions.alcoholHours);
  const spiralLock = store.smsClient.spiralLock;
  const support = spiralLock.trustedContactSupport;
  const [supportName, setSupportName] = useState(support.contactName);
  const [supportPhone, setSupportPhone] = useState(support.phone);
  const [supportMessage, setSupportMessage] = useState(support.message);
  const conditions = store.preferences.launchConditions;

  const saveContact = () => {
    if (!contactName.trim() && !contactMethod.trim()) return setTrustedContact(undefined);
    setTrustedContact({ name: contactName.trim() || "Someone you trust", method: contactMethod.trim() });
  };

  const saveSupportSetup = () => {
    updateSpiralLock({
      trustedContactSupport: {
        ...support,
        contactName: supportName.trim(),
        phone: supportPhone.trim(),
        message: supportMessage.trim(),
      },
    });
  };

  const toggleSpiralLock = () => {
    updateSpiralLock({
      enabled: !spiralLock.enabled,
      trustedContactSupport: spiralLock.enabled ? { ...support, enabled: false } : support,
    });
  };

  const toggleSupport = () => {
    const nextEnabled = !support.enabled;
    if (nextEnabled && (!supportPhone.trim() || !supportMessage.trim() || !support.acknowledged)) {
      Alert.alert("Finish support setup", "Save a phone number and support message, then acknowledge that this separate peer-support text can be sent when Spiral Lock activates.");
      return;
    }
    updateSpiralLock({ trustedContactSupport: { ...support, enabled: nextEnabled } });
  };

  const exportData = async () => {
    const json = exportJson();
    try {
      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "holdoff-local-data.json";
        anchor.click();
        URL.revokeObjectURL(url);
        Alert.alert("Export ready", "Your local JSON file is downloading now.");
        return;
      }
      const [FileSystem, Sharing] = await Promise.all([import("expo-file-system/legacy"), import("expo-sharing")]);
      const fileUri = `${FileSystem.cacheDirectory}holdoff-local-data.json`;
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: "application/json", dialogTitle: "Export HoldOff data" });
      else Alert.alert("Export prepared", "Your local JSON export is ready in HoldOff’s app storage, but this device cannot open a share sheet.");
    } catch {
      Alert.alert("Export unavailable", "Your data remains safe on this device. Please try again in a moment.");
    }
  };

  const confirmDelete = () => Alert.alert("Delete everything?", "This removes every local draft, message record, insight, setting, and consent from this device. This cannot be undone.", [
    { text: "Keep my data", style: "cancel" },
    { text: "Continue", style: "destructive", onPress: () => Alert.alert("One more check", "Delete all HoldOff data from this device now?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete everything", style: "destructive", onPress: () => { void deleteEverything(); } },
    ]) },
  ]);

  return <VelvetScreen><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <PageHeader eyebrow="Private by default" title="Settings" subtitle="Everything here lives locally on this device unless you choose to export it." />

    <Text style={styles.sectionTitle}>Android messenger</Text>
    <SectionCard><Text style={styles.contactNote}>Messages, direct sends, and trusted-contact support only work after Android makes HoldOff the default SMS app and you grant messaging access. The web preview cannot read or send SMS.</Text><PrimaryButton label="Review Android activation" onPress={() => router.push("/default-sms" as any)} /></SectionCard>

    <Text style={styles.sectionTitle}>Spiral Lock</Text>
    <SectionCard><ToggleRow tag="OPT-IN" label="Enable Spiral Lock" description="When your selected local writing cues appear at the send moment, HoldOff holds the message before native transmission. You can always review, release, edit, discard, or turn this off." value={spiralLock.enabled} onPress={toggleSpiralLock} /><ToggleRow tag="LOCAL" label="Show emotional pause cues" description="On this device, show observable writing cues in the current draft as an invitation to pause. This is not a diagnosis, does not analyze your inbox, and never sends anything." value={spiralLock.emotionalCueCheckEnabled} onPress={() => updateSpiralLock({ emotionalCueCheckEnabled: !spiralLock.emotionalCueCheckEnabled })} /><ToggleRow label="All-caps cues" description="Use all-caps wording as a local signal to offer a pause." value={spiralLock.triggerAllCaps} onPress={() => updateSpiralLock({ triggerAllCaps: !spiralLock.triggerAllCaps })} /><ToggleRow label="Repeated punctuation" description="Use repeated punctuation as a local signal to offer a pause." value={spiralLock.triggerRepeatedPunctuation} onPress={() => updateSpiralLock({ triggerRepeatedPunctuation: !spiralLock.triggerRepeatedPunctuation })} /><ToggleRow label="Rapid typing" description="Use a long continuous drafting burst as a local signal to offer a pause." value={spiralLock.triggerRapidTyping} onPress={() => updateSpiralLock({ triggerRapidTyping: !spiralLock.triggerRapidTyping })} /></SectionCard>

    <Text style={styles.sectionTitle}>Trusted-contact support</Text>
    <SectionCard><Text style={styles.contactNote}>Optional peer support for Spiral Lock. When both settings are enabled and Spiral Lock activates, HoldOff can queue the separate support SMS below after its visible cancel window. It does <Text style={styles.strong}>not</Text> include your held message, chat history, or interpretation. Ask this person if they are comfortable being your support contact.</Text><Text style={styles.inputLabel}>Contact name</Text><TextInput value={supportName} onChangeText={setSupportName} placeholder="Name" placeholderTextColor={HOLD_OFF.muted} style={styles.input} /><Text style={styles.inputLabel}>SMS number</Text><TextInput value={supportPhone} onChangeText={setSupportPhone} keyboardType="phone-pad" placeholder="Phone number" placeholderTextColor={HOLD_OFF.muted} style={styles.input} /><Text style={styles.inputLabel}>Support message</Text><TextInput value={supportMessage} onChangeText={setSupportMessage} placeholder="Write the check-in you want sent" placeholderTextColor={HOLD_OFF.muted} style={[styles.input, styles.messageInput]} multiline /><PrimaryButton compact label="Save support setup" onPress={saveSupportSetup} /><View style={styles.buttonGap} /><ToggleRow label="I understand this can send a separate support SMS" description="This does not replace therapy, crisis care, or emergency services. You can cancel during the visible countdown and revoke this setting any time." value={support.acknowledged} onPress={() => updateSpiralLock({ trustedContactSupport: { ...support, acknowledged: !support.acknowledged } })} /><ToggleRow tag="OPTIONAL" label="Send support SMS when Spiral Lock activates" description={support.enabled ? "Enabled. It will only queue in an Android default-SMS installation after the visible cancel window." : "Disabled. Saving contact details alone never sends anything."} value={support.enabled} onPress={toggleSupport} /></SectionCard>

    <Text style={styles.sectionTitle}>Launch conditions</Text>
    <SectionCard><ToggleRow tag="CORE" label="Late-night drafting" description="Notice drafts started during quieter hours." value={conditions.lateNight} onPress={() => updatePreferences({ lateNight: !conditions.lateNight })} /><ToggleRow tag="CORE" label="All-caps bursts" description="Notice when intensity rises in the wording." value={conditions.allCaps} onPress={() => updatePreferences({ allCaps: !conditions.allCaps })} /><ToggleRow tag="CORE" label="Rapid re-drafting" description="Notice repeated holds for the same person." value={conditions.rapidRedrafting} onPress={() => updatePreferences({ rapidRedrafting: !conditions.rapidRedrafting })} /><ToggleRow label="Alcohol-window hours" description="Use a time window you choose, if it helps." value={conditions.alcoholWindow} onPress={() => updatePreferences({ alcoholWindow: !conditions.alcoholWindow })} /><TextInput value={alcoholHours} onChangeText={(value) => { setAlcoholHours(value); updatePreferences({ alcoholHours: value }); }} placeholder="e.g. 9 PM – 2 AM" placeholderTextColor={HOLD_OFF.muted} style={styles.inlineInput} /><ToggleRow label="Specific people" description="Keep the people you add to HoldOff in view." value={conditions.specificPeople} onPress={() => updatePreferences({ specificPeople: !conditions.specificPeople })} /></SectionCard>

    <Text style={styles.sectionTitle}>Consent</Text>
    <SectionCard><ToggleRow label="AI analysis of selected text" description={store.onboarding.analysisConsent ? "Sadie can analyze only a current draft or the conversation history that you explicitly review and submit. It does not scan the inbox in the background." : "Manual-only mode is on. Sadie will not analyze or invent an answer."} value={store.onboarding.analysisConsent} onPress={() => updateOnboarding({ analysisConsent: !store.onboarding.analysisConsent })} /><ToggleRow label="Writing-based mood patterns" description="Use saved drafts and Sadie chats to show passive writing patterns." value={store.onboarding.moodLearningConsent} onPress={() => updateOnboarding({ moodLearningConsent: !store.onboarding.moodLearningConsent })} /></SectionCard>

    <Text style={styles.sectionTitle}>Saved trusted contact</Text>
    <SectionCard><Text style={styles.contactNote}>This saved contact stays local. It does not automatically receive messages unless you separately configure and enable trusted-contact support above.</Text><Text style={styles.inputLabel}>Name</Text><TextInput value={contactName} onChangeText={setContactName} placeholder="Name" placeholderTextColor={HOLD_OFF.muted} style={styles.input} /><Text style={styles.inputLabel}>Phone or email</Text><TextInput value={contactMethod} onChangeText={setContactMethod} placeholder="Phone or email" placeholderTextColor={HOLD_OFF.muted} style={styles.input} autoCapitalize="none" /><View style={styles.twoActions}><View style={styles.actionHalf}><PrimaryButton compact label="Save contact" onPress={saveContact} /></View><View style={styles.actionHalf}><SecondaryButton compact label="Remove" onPress={() => { setContactName(""); setContactMethod(""); setTrustedContact(undefined); }} /></View></View></SectionCard>

    <Text style={styles.sectionTitle}>Your local data</Text>
    <SectionCard><Text style={styles.contactNote}>Export includes local message records, held messages, people, settings, consents, and saved writing events as a JSON file.</Text><PrimaryButton label="Export local data (JSON)" onPress={exportData} /><View style={styles.buttonGap} /><SecondaryButton tone="danger" label="Delete everything" onPress={confirmDelete} /></SectionCard>

    <Text style={styles.sectionTitle}>HoldOff</Text>
    <SectionCard><Pressable onPress={() => router.push("/pricing" as any)} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}><View><Text style={styles.linkTitle}>Plans & preview</Text><Text style={styles.linkDescription}>See accurate plans — payments open at launch.</Text></View><Text style={styles.chevron}>›</Text></Pressable><View style={styles.rule} /><Text style={styles.aboutTitle}>About this app</Text><Text style={styles.aboutText}>{APP_COPY.capability}</Text><Text style={styles.aboutText}>{APP_COPY.supportBoundary}</Text><Text style={styles.aboutText}>If you’re in crisis, call or text <Text style={styles.strong}>988</Text> in the US. In an emergency, call local emergency services.</Text></SectionCard>
  </ScrollView><SadieAssistant /></VelvetScreen>;
}

const styles = StyleSheet.create({
  scroll: { paddingTop: 6, paddingBottom: 112, gap: 14 }, sectionTitle: { color: HOLD_OFF.lavender, fontSize: 12, lineHeight: 17, letterSpacing: 0.9, fontWeight: "800", textTransform: "uppercase", marginTop: 5 }, toggleRow: { minHeight: 66, flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(61,42,102,0.67)" }, toggleCopy: { flex: 1 }, labelLine: { flexDirection: "row", alignItems: "center", gap: 7 }, toggleLabel: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, tag: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "rgba(184,166,240,0.16)" }, tagText: { color: HOLD_OFF.lavender, fontSize: 9, lineHeight: 12, fontWeight: "800", letterSpacing: 0.5 }, toggleDescription: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 18, marginTop: 2 }, toggle: { width: 43, height: 26, borderRadius: 13, backgroundColor: HOLD_OFF.border, padding: 3 }, toggleOn: { backgroundColor: HOLD_OFF.violet }, toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: HOLD_OFF.text }, toggleKnobOn: { alignSelf: "flex-end" }, inlineInput: { marginTop: 8, marginBottom: 6, color: HOLD_OFF.text, borderWidth: 1, borderColor: HOLD_OFF.border, backgroundColor: "#2A1A4A", minHeight: 46, borderRadius: 13, paddingHorizontal: 12, fontSize: 15 }, contactNote: { color: HOLD_OFF.muted, fontSize: 13, lineHeight: 20, marginBottom: 14 }, inputLabel: { color: HOLD_OFF.moon, fontSize: 13, lineHeight: 18, fontWeight: "700", marginBottom: 7 }, input: { color: HOLD_OFF.text, borderWidth: 1, borderColor: HOLD_OFF.border, backgroundColor: "#2A1A4A", minHeight: 48, borderRadius: 14, fontSize: 16, paddingHorizontal: 13, marginBottom: 13 }, messageInput: { minHeight: 94, paddingTop: 12, textAlignVertical: "top" }, twoActions: { flexDirection: "row", gap: 10 }, actionHalf: { flex: 1 }, buttonGap: { height: 10 }, linkRow: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, linkTitle: { color: HOLD_OFF.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, linkDescription: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 18, marginTop: 2 }, chevron: { color: HOLD_OFF.lavender, fontSize: 28, lineHeight: 30 }, rule: { height: 1, backgroundColor: HOLD_OFF.border, marginVertical: 13 }, aboutTitle: { color: HOLD_OFF.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, aboutText: { color: HOLD_OFF.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }, strong: { color: HOLD_OFF.lavender, fontWeight: "800" }, pressed: { transform: [{ scale: 0.98 }], opacity: 0.86 },
});
