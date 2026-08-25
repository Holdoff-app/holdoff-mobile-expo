import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton, SecondaryButton } from "@/components/holdoff-ui";
import { HOLD_OFF } from "@/constants/holdoff-theme";

export function ThreadImportSheet({ visible, personName, onImport, onClose }: { visible: boolean; personName: string; onImport: (content: string) => void; onClose: () => void }) {
  const [content, setContent] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const paste = async () => {
    try {
      const Clipboard = await import("expo-clipboard");
      const value = await Clipboard.getStringAsync();
      if (!value.trim()) return Alert.alert("Nothing to paste", "Copy the messages you want to bring in from your SMS app, then return here.");
      setContent(value.slice(0, 16000));
    } catch {
      Alert.alert("Paste unavailable", "You can still paste the conversation directly into the field below.");
    }
  };
  const finish = () => {
    if (!content.trim() || !confirmed) return;
    onImport(content);
    setContent("");
    setConfirmed(false);
    onClose();
  };
  const close = () => { setContent(""); setConfirmed(false); onClose(); };
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={close}><View style={styles.backdrop}><View style={styles.sheet}><View style={styles.handle} /><View style={styles.header}><View><Text style={styles.title}>Import a selected thread</Text><Text style={styles.subtitle}>With {personName}</Text></View><Pressable onPress={close} style={styles.close}><Text style={styles.closeText}>Close</Text></Pressable></View><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.notice}><Text style={styles.noticeTitle}>You stay in control.</Text><Text style={styles.noticeText}>HoldOff cannot browse your SMS inbox or choose a conversation for you. In your messaging app, select the messages you want, copy them, then paste them here. This content stays on this device unless you export your HoldOff data.</Text></View><View style={styles.steps}><Text style={styles.step}>1. Select and copy the conversation in your SMS app.</Text><Text style={styles.step}>2. Return here and paste only what you want to keep.</Text><Text style={styles.step}>3. Review it before importing locally.</Text></View><SecondaryButton label="Paste copied messages" onPress={paste} /><Text style={styles.label}>Conversation text</Text><TextInput value={content} onChangeText={(value) => setContent(value.slice(0, 16000))} placeholder="Paste the messages you chose here…" placeholderTextColor={HOLD_OFF.muted} style={styles.input} multiline textAlignVertical="top" maxLength={16000} /><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => setConfirmed(!confirmed)} style={({ pressed }) => [styles.confirmRow, pressed && styles.pressed]}><View style={[styles.box, confirmed && styles.boxOn]}><Text style={styles.tick}>{confirmed ? "✓" : ""}</Text></View><Text style={styles.confirmText}>I chose this conversation and want to save this copy locally in HoldOff.</Text></Pressable><PrimaryButton label="Import this local copy" onPress={finish} disabled={!content.trim() || !confirmed} /></ScrollView></View></View></Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(9,4,20,0.58)" }, sheet: { maxHeight: "90%", backgroundColor: "#21143A", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: HOLD_OFF.border, paddingHorizontal: 18 }, handle: { width: 42, height: 4, borderRadius: 4, backgroundColor: HOLD_OFF.border, alignSelf: "center", marginTop: 12, marginBottom: 14 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: HOLD_OFF.border }, title: { color: HOLD_OFF.text, fontSize: 20, lineHeight: 27, fontWeight: "700" }, subtitle: { color: HOLD_OFF.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }, close: { minHeight: 44, justifyContent: "center", paddingHorizontal: 5 }, closeText: { color: HOLD_OFF.lavender, fontSize: 14, fontWeight: "700" }, content: { paddingTop: 15, paddingBottom: 26, gap: 12 }, notice: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "rgba(184,166,240,0.32)", backgroundColor: "rgba(184,166,240,0.10)" }, noticeTitle: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, noticeText: { color: HOLD_OFF.muted, fontSize: 13, lineHeight: 20, marginTop: 4 }, steps: { gap: 5 }, step: { color: HOLD_OFF.muted, fontSize: 13, lineHeight: 19 }, label: { color: HOLD_OFF.moon, fontSize: 13, lineHeight: 18, fontWeight: "700", marginTop: 2 }, input: { color: HOLD_OFF.text, minHeight: 165, borderRadius: 15, borderWidth: 1, borderColor: HOLD_OFF.border, backgroundColor: "#2A1A4A", padding: 13, fontSize: 15, lineHeight: 22 }, confirmRow: { flexDirection: "row", alignItems: "center", gap: 11, minHeight: 54 }, box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: HOLD_OFF.lavender, alignItems: "center", justifyContent: "center" }, boxOn: { backgroundColor: HOLD_OFF.violet, borderColor: HOLD_OFF.violet }, tick: { color: HOLD_OFF.text, fontSize: 15, fontWeight: "800" }, confirmText: { flex: 1, color: HOLD_OFF.text, fontSize: 13, lineHeight: 20 }, pressed: { transform: [{ scale: 0.98 }], opacity: 0.86 },
});
