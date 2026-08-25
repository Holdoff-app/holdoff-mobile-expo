import { Alert, Platform, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";

import { PrimaryButton, SecondaryButton, SectionCard } from "@/components/holdoff-ui";
import { HOLD_OFF } from "@/constants/holdoff-theme";

export function SmsPermissionDenialGuidance({ onRetry, onKeepManual }: { onRetry: () => void; onKeepManual: () => void }) {
  const openSettings = async () => {
    if (Platform.OS !== "android") {
      Alert.alert("Android settings unavailable", "Permission settings can be revisited only from an installed Android HoldOff app.");
      return;
    }
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert("Couldn’t open Settings", "You can still keep using HoldOff without SMS access and revisit permissions from Android Settings later.");
    }
  };

  return <SectionCard style={styles.card}><Text style={styles.eyebrow}>SMS ACCESS IS OFF</Text><Text style={styles.title}>That choice is okay.</Text><Text style={styles.body}>HoldOff will continue to work as a message companion. It will not read, receive, send, or notify you about SMS messages unless you choose to grant access later.</Text><View style={styles.why}><Text style={styles.whyTitle}>Why HoldOff asks</Text><Text style={styles.whyText}>• Incoming-message access lets the app show new messages and notifications.</Text><Text style={styles.whyText}>• Conversation access lets the app show your SMS inbox on this device.</Text><Text style={styles.whyText}>• Send access lets HoldOff send only when you choose to send from its messaging screen.</Text></View><Text style={styles.choice}>You can keep using your current messaging app, copy drafts from HoldOff, and return here whenever you want. Nothing else is blocked.</Text><PrimaryButton label="Try permission request again" onPress={onRetry} /><View style={styles.gap} /><SecondaryButton label="Open Android app settings" onPress={() => { void openSettings(); }} /><Text style={styles.settingsNote}>Use this only if you want to review an Android “Don’t ask again” choice. Changing permissions remains entirely optional.</Text><View style={styles.gap} /><SecondaryButton label="Keep using manual messaging" onPress={onKeepManual} /></SectionCard>;
}

const styles = StyleSheet.create({
  card: { borderColor: "rgba(210,188,116,0.48)", backgroundColor: "rgba(64,47,81,0.92)" },
  eyebrow: { color: HOLD_OFF.gold, fontSize: 11, lineHeight: 16, letterSpacing: 0.8, fontWeight: "800" },
  title: { color: HOLD_OFF.text, fontSize: 20, lineHeight: 27, fontWeight: "700", marginTop: 4 },
  body: { color: HOLD_OFF.muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  why: { marginTop: 14, padding: 13, borderRadius: 14, backgroundColor: "rgba(210,188,116,0.09)", borderWidth: 1, borderColor: "rgba(210,188,116,0.24)", gap: 5 },
  whyTitle: { color: HOLD_OFF.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  whyText: { color: HOLD_OFF.muted, fontSize: 13, lineHeight: 19 },
  choice: { color: HOLD_OFF.lavender, fontSize: 13, lineHeight: 20, marginVertical: 14 },
  settingsNote: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 9 },
  gap: { height: 10 },
});
