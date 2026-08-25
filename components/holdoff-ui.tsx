import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { HOLD_OFF } from "@/constants/holdoff-theme";
import { useHoldOff } from "@/components/holdoff-provider";
import type { DraftStatus, SadieExpression } from "@/lib/holdoff-types";
import { statusLabel } from "@/lib/holdoff-utils";

export function VelvetScreen({ children }: PropsWithChildren) {
  return (
    <View style={styles.screen}>
      <View style={styles.violetGlow} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.pageTitle}>{title}</Text>
      {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionCard({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({ label, onPress, disabled = false, compact = false }: { label: string; onPress: () => void; disabled?: boolean; compact?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, compact && styles.compactButton, disabled && styles.disabled, pressed && styles.pressed]}>
      <View style={styles.gradientButton}>
        <Text style={[styles.primaryButtonText, compact && styles.compactButtonText]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, compact = false, tone = "default" }: { label: string; onPress: () => void; compact?: boolean; tone?: "default" | "danger" }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondaryButton, compact && styles.compactButton, tone === "danger" && styles.dangerBorder, pressed && styles.pressed]}><Text style={[styles.secondaryButtonText, compact && styles.compactButtonText, tone === "danger" && styles.dangerText]}>{label}</Text></Pressable>;
}

export function StatusChip({ status }: { status: DraftStatus }) {
  const chipStyle = status === "SENT" ? styles.sentChip : status === "READY_TO_SEND" ? styles.readyChip : status === "DISCARDED" ? styles.discardedChip : styles.heldChip;
  return <View style={[styles.statusChip, chipStyle]}><Text style={styles.statusChipText}>{statusLabel(status)}</Text></View>;
}

export function SadieAvatar({ expression = "calm", small = false }: { expression?: SadieExpression; small?: boolean }) {
  const breath = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1.035, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [breath]);
  const mouth = expression === "celebrating" || expression === "encouraging" ? "⌣" : expression === "concerned" ? "⌢" : "—";
  const eye = expression === "listening" ? "◦" : "•";
  return (
    <Animated.View style={[styles.sadieAura, small && styles.sadieAuraSmall, { transform: [{ scale: breath }] }]}>
      <View style={[styles.sadieFace, small && styles.sadieFaceSmall]}>
        <View style={styles.sadieHair} />
        <View style={styles.sadieEyes}><Text style={[styles.sadieEye, small && styles.sadieEyeSmall]}>{eye}</Text><Text style={[styles.sadieEye, small && styles.sadieEyeSmall]}>{eye}</Text></View>
        <Text style={[styles.sadieMouth, small && styles.sadieMouthSmall]}>{mouth}</Text>
      </View>
    </Animated.View>
  );
}

export function SadieAssistant({ source = "general", inline = false }: { source?: "general" | "thread"; inline?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const { store, sendChat } = useHoldOff();
  const expression: SadieExpression = store.chats.at(-1)?.role === "user" ? "listening" : "calm";
  const submit = async () => {
    const value = message.trim();
    if (!value) return;
    setMessage("");
    await sendChat(value, source === "thread" ? { source: "thread" } : undefined);
  };
  return (
    <>
      {inline ? <Pressable accessibilityRole="button" accessibilityLabel="Talk with Sadie about this thread" onPress={() => setOpen(true)} style={({ pressed }) => [styles.threadSadieEntry, pressed && styles.pressed]}><SadieAvatar expression={expression} small /><View style={styles.threadSadieCopy}><Text style={styles.threadSadieTitle}>Talk with Sadie</Text><Text style={styles.threadSadieText}>{store.onboarding.analysisConsent ? "Get support in this moment. Thread text stays private unless you choose Analyze conversation." : "Enable selected-text analysis in Settings to chat with Sadie."}</Text></View><Text style={styles.threadSadieChevron}>›</Text></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Talk with Sadie" onPress={() => setOpen(true)} style={({ pressed }) => [styles.sadieFab, pressed && styles.pressed]}><SadieAvatar expression={expression} small /></Pressable>}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.drawerBackdrop}>
          <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={styles.drawerKeyboard}>
            <View style={styles.drawer}>
              <View style={styles.drawerHandle} />
                <View style={styles.drawerHeader}>
                <View style={styles.drawerTitleRow}><SadieAvatar expression="listening" small /><View><Text style={styles.drawerTitle}>Sadie</Text><Text style={styles.drawerSubtitle}>{source === "thread" ? "Here with you in this thread." : "Here with you, not above you."}</Text></View></View>
                <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>Close</Text></Pressable>
              </View>
              {source === "thread" ? <Text style={styles.threadSadieDisclosure}>This chat does not include your thread. Use Analyze conversation separately if you want to review and submit a disclosed scope of local messages.</Text> : null}
              {!store.onboarding.analysisConsent ? <Text style={styles.threadSadieDisclosure}>Selected-text analysis is off in Settings, so Sadie will not receive a message from this chat.</Text> : null}
              <FlatList
                data={store.chats}
                keyExtractor={(item) => item.id}
                style={styles.chatList}
                contentContainerStyle={store.chats.length ? styles.chatContent : styles.chatEmpty}
                ListEmptyComponent={<Text style={styles.emptyText}>I’m here for what this moment feels like. You can start wherever you are.</Text>}
                renderItem={({ item }) => <View style={[styles.chatBubble, item.role === "user" ? styles.userBubble : styles.sadieBubble]}><Text style={styles.chatText}>{item.text}</Text></View>}
              />
              <View style={styles.chatComposer}><TextInput value={message} onChangeText={setMessage} placeholder="Say what’s on your mind…" placeholderTextColor={HOLD_OFF.muted} style={styles.chatInput} multiline /><Pressable accessibilityRole="button" onPress={submit} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}><Text style={styles.sendText}>↑</Text></Pressable></View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: HOLD_OFF.midnight }, violetGlow: { position: "absolute", width: 310, height: 310, borderRadius: 155, backgroundColor: "#54379A", opacity: 0.18, top: -115, right: -125 }, content: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  header: { paddingTop: 8, paddingBottom: 20 }, eyebrow: { color: HOLD_OFF.lavender, fontSize: 12, lineHeight: 18, letterSpacing: 1.2, fontWeight: "700", textTransform: "uppercase", marginBottom: 6 }, pageTitle: { color: HOLD_OFF.text, fontSize: 31, lineHeight: 38, letterSpacing: -0.7, fontWeight: "700" }, pageSubtitle: { color: HOLD_OFF.muted, fontSize: 16, lineHeight: 24, marginTop: 7 },
  card: { backgroundColor: HOLD_OFF.surface, borderWidth: 1, borderColor: HOLD_OFF.border, borderRadius: 22, padding: 18, shadowColor: HOLD_OFF.shadow, shadowOpacity: 0.42, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 }, primaryButton: { minHeight: 52, borderRadius: 16, overflow: "hidden" }, gradientButton: { flex: 1, minHeight: 52, paddingHorizontal: 18, borderRadius: 16, justifyContent: "center", alignItems: "center" }, primaryButtonText: { color: HOLD_OFF.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, secondaryButton: { minHeight: 50, borderRadius: 16, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: HOLD_OFF.border, backgroundColor: "rgba(61,42,102,0.28)", paddingHorizontal: 16 }, secondaryButtonText: { color: HOLD_OFF.moon, fontSize: 15, lineHeight: 20, fontWeight: "700", textAlign: "center" }, compactButton: { minHeight: 42 }, compactButtonText: { fontSize: 14, lineHeight: 18 }, disabled: { opacity: 0.42 }, pressed: { transform: [{ scale: 0.975 }], opacity: 0.9 }, dangerBorder: { borderColor: "rgba(217,152,184,0.65)" }, dangerText: { color: HOLD_OFF.danger },
  statusChip: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 }, heldChip: { backgroundColor: "rgba(210,188,116,0.12)", borderColor: "rgba(210,188,116,0.42)" }, readyChip: { backgroundColor: "rgba(103,214,177,0.12)", borderColor: "rgba(103,214,177,0.42)" }, sentChip: { backgroundColor: "rgba(184,166,240,0.14)", borderColor: "rgba(184,166,240,0.44)" }, discardedChip: { backgroundColor: "rgba(169,156,201,0.12)", borderColor: "rgba(169,156,201,0.32)" }, statusChipText: { color: HOLD_OFF.text, fontSize: 11, lineHeight: 15, fontWeight: "700", letterSpacing: 0.45 },
  sadieAura: { width: 94, height: 94, borderRadius: 47, backgroundColor: "rgba(184,166,240,0.20)", justifyContent: "center", alignItems: "center", shadowColor: HOLD_OFF.violet, shadowOpacity: 0.56, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 7 }, sadieAuraSmall: { width: 64, height: 64, borderRadius: 32 }, sadieFace: { width: 76, height: 76, borderRadius: 38, justifyContent: "center", alignItems: "center", overflow: "hidden" }, sadieFaceSmall: { width: 54, height: 54, borderRadius: 27 }, sadieHair: { position: "absolute", backgroundColor: "#5D4B92", width: "108%", height: "38%", top: -3, borderBottomLeftRadius: 55, borderBottomRightRadius: 55 }, sadieEyes: { flexDirection: "row", gap: 15, marginTop: 9 }, sadieEye: { color: "#3B285F", fontSize: 18, lineHeight: 18, fontWeight: "900" }, sadieEyeSmall: { fontSize: 13, lineHeight: 13 }, sadieMouth: { color: "#3B285F", fontSize: 24, lineHeight: 24, marginTop: 2, fontWeight: "700" }, sadieMouthSmall: { fontSize: 17, lineHeight: 17 }, sadieFab: { position: "absolute", right: 18, bottom: 86, zIndex: 30 }, threadSadieEntry: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginBottom: 8, borderRadius: 17, backgroundColor: "rgba(184,166,240,0.12)", borderWidth: 1, borderColor: "rgba(184,166,240,0.42)" }, threadSadieCopy: { flex: 1 }, threadSadieTitle: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 21, fontWeight: "800" }, threadSadieText: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 18, marginTop: 2 }, threadSadieChevron: { color: HOLD_OFF.lavender, fontSize: 28, lineHeight: 30 },
  drawerBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(9,4,20,0.52)" }, drawerKeyboard: { maxHeight: "82%" }, drawer: { minHeight: 410, maxHeight: "100%", backgroundColor: "#21143A", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: HOLD_OFF.border, padding: 18 }, drawerHandle: { width: 42, height: 4, borderRadius: 4, backgroundColor: HOLD_OFF.border, alignSelf: "center", marginBottom: 14 }, drawerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: "rgba(61,42,102,0.75)" }, drawerTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 }, drawerTitle: { color: HOLD_OFF.text, fontSize: 19, lineHeight: 25, fontWeight: "700" }, drawerSubtitle: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 17 }, threadSadieDisclosure: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 18, marginTop: 10, paddingHorizontal: 2 }, closeButton: { minWidth: 48, minHeight: 44, justifyContent: "center", alignItems: "flex-end" }, closeText: { color: HOLD_OFF.lavender, fontSize: 14, fontWeight: "700" }, chatList: { flexGrow: 0, marginTop: 14 }, chatContent: { gap: 10, paddingBottom: 14 }, chatEmpty: { flexGrow: 1, justifyContent: "center", paddingVertical: 38 }, chatBubble: { maxWidth: "88%", paddingVertical: 11, paddingHorizontal: 13, borderRadius: 16 }, userBubble: { alignSelf: "flex-end", backgroundColor: HOLD_OFF.blue }, sadieBubble: { alignSelf: "flex-start", backgroundColor: "#312052", borderWidth: 1, borderColor: HOLD_OFF.border }, chatText: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 22 }, chatComposer: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(61,42,102,0.75)" }, chatInput: { flex: 1, minHeight: 46, maxHeight: 94, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 12, color: HOLD_OFF.text, backgroundColor: "#2A1A4A", borderWidth: 1, borderColor: HOLD_OFF.border, fontSize: 15, lineHeight: 21 }, sendButton: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: HOLD_OFF.violet }, sendText: { color: HOLD_OFF.text, fontSize: 24, lineHeight: 26, fontWeight: "700" }, emptyText: { color: HOLD_OFF.muted, textAlign: "center", fontSize: 15, lineHeight: 22 },
});
