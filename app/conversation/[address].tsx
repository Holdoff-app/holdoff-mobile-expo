import { useEffect, useMemo, useState } from "react";
import { Alert, AppState, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { PrimaryButton, SadieAssistant, SecondaryButton, VelvetScreen } from "@/components/holdoff-ui";
import { useHoldOff } from "@/components/holdoff-provider";
import { HOLD_OFF } from "@/constants/holdoff-theme";
import type { ConversationHistoryAnalysis, RewriteTone, SadieAnalysis, SmsMessageRecord } from "@/lib/holdoff-types";
import { deriveWritingCues } from "@/lib/holdoff-utils";
import { normalizeSmsAddress } from "@/lib/sms-event-sync";
import { detectEmotionalSpiralCues, shouldTriggerSpiralLock } from "@/lib/spiral-lock";
import { buildConversationAnalysisScope } from "@/lib/conversation-analysis";

type SupportCountdown = { heldId: string; secondsRemaining: number };

function deliveryLabel(status: SmsMessageRecord["status"]): string {
  if (status === "queued") return "Queued";
  if (status === "sent") return "Sent";
  if (status === "delivered") return "Delivered";
  if (status === "failed") return "Not sent";
  return "Received";
}

function timeLabel(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ address?: string; quickReply?: string }>();
  const initialAddress = typeof params.address === "string" ? params.address : "new";
  const isNewConversation = initialAddress === "new";
  const { store, syncNativeSmsEvents, markSmsConversationRead, holdOutgoingMessage, removeHeldMessage, updateHeldMessageSupport, sendNativeSms, analyzeCurrentMessage, analyzeConversationHistory } = useHoldOff();
  const [address, setAddress] = useState(isNewConversation ? "" : initialAddress);
  const [body, setBody] = useState("");
  const [composerStartedAt, setComposerStartedAt] = useState<number>();
  const [decisionVisible, setDecisionVisible] = useState(false);
  const [supportCountdown, setSupportCountdown] = useState<SupportCountdown>();
  const [sendFeedback, setSendFeedback] = useState<string>();
  const [draftAnalysis, setDraftAnalysis] = useState<SadieAnalysis>();
  const [historyAnalysis, setHistoryAnalysis] = useState<ConversationHistoryAnalysis>();
  const [isAnalyzingDraft, setIsAnalyzingDraft] = useState(false);
  const [isAnalyzingHistory, setIsAnalyzingHistory] = useState(false);
  const [rewriteTone, setRewriteTone] = useState<RewriteTone>("balanced");
  const addressValue = address.trim();
  const conversationId = addressValue ? `sms-conversation:${normalizeSmsAddress(addressValue)}` : "";
  const conversation = store.smsClient.conversations.find((item) => item.id === conversationId);
  const thread = useMemo(
    () => store.smsClient.messages.filter((message) => message.conversationId === conversationId).sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [conversationId, store.smsClient.messages],
  );
  const heldMessages = useMemo(
    () => store.smsClient.heldMessages.filter((message) => message.conversationId === conversationId),
    [conversationId, store.smsClient.heldMessages],
  );
  const nativeReady = store.smsClient.roleStatus === "active" && store.smsClient.permissionStatus === "granted";
  const spiralLock = store.smsClient.spiralLock;
  const support = spiralLock.trustedContactSupport;
  const recipient = (conversation?.displayName ?? addressValue) || "New message";
  const currentCues = deriveWritingCues(body, composerStartedAt ? (Date.now() - composerStartedAt) / 1000 : 0, 0);
  const emotionalCues = detectEmotionalSpiralCues(spiralLock, body, currentCues);
  const historyScope = useMemo(() => buildConversationAnalysisScope(thread), [thread]);

  useEffect(() => {
    void syncNativeSmsEvents();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNativeSmsEvents();
    });
    return () => subscription.remove();
  }, [syncNativeSmsEvents]);

  useEffect(() => {
    if (isNewConversation || !conversationId || !addressValue) return;
    void markSmsConversationRead({ conversationId, address: addressValue });
  }, [addressValue, conversationId, isNewConversation, markSmsConversationRead]);

  useEffect(() => {
    if (params.quickReply !== "1") return;
    setSendFeedback("Reply is ready to review here. HoldOff will not send anything until you choose to.");
  }, [params.quickReply]);

  useEffect(() => {
    setHistoryAnalysis(undefined);
  }, [conversationId, thread.length]);

  useEffect(() => {
    if (!supportCountdown) return;
    if (supportCountdown.secondsRemaining <= 0) {
      void (async () => {
        const held = store.smsClient.heldMessages.find((item) => item.id === supportCountdown.heldId);
        if (!held) {
          setSupportCountdown(undefined);
          return;
        }
        const sent = await sendNativeSms({ address: support.phone, body: support.message });
        updateHeldMessageSupport(held.id, sent ? { supportStatus: "queued", supportMessageId: sent.id } : { supportStatus: "failed" });
        setSupportCountdown(undefined);
      })();
      return;
    }
    const timeout = setTimeout(() => {
      setSupportCountdown((current) => current ? { ...current, secondsRemaining: current.secondsRemaining - 1 } : undefined);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [sendNativeSms, store.smsClient.heldMessages, support.phone, support.message, supportCountdown, updateHeldMessageSupport]);

  const clearComposer = () => {
    setBody("");
    setComposerStartedAt(undefined);
    setDecisionVisible(false);
  };

  const scheduleTrustedSupport = (heldId: string) => {
    const canSupport = nativeReady && support.enabled && support.acknowledged && Boolean(support.phone.trim()) && Boolean(support.message.trim());
    if (!canSupport) return;
    updateHeldMessageSupport(heldId, { supportStatus: "pending" });
    setSupportCountdown({ heldId, secondsRemaining: support.cancellationSeconds });
  };

  const holdMessage = (reason: "user_hold" | "configured_cues") => {
    const heldId = holdOutgoingMessage({ address: addressValue, body, reason });
    if (!heldId) return;
    clearComposer();
    setSendFeedback(reason === "configured_cues" ? "Spiral Lock is holding this message." : "Your message is held locally and has not been sent.");
    if (reason === "configured_cues") scheduleTrustedSupport(heldId);
  };

  const sendMessage = async () => {
    const sent = await sendNativeSms({ address: addressValue, body });
    if (sent) {
      clearComposer();
      setSendFeedback("Message queued with Android. Delivery status will update when the system reports it.");
    } else {
      setDecisionVisible(false);
      setSendFeedback(nativeReady ? "HoldOff could not queue this message. It remains in the composer." : "Activate HoldOff as the default SMS app and grant messaging access before sending directly.");
    }
  };

  const onSendPress = () => {
    if (!addressValue || !body.trim()) {
      setSendFeedback("Add a recipient and message before sending.");
      return;
    }
    if (shouldTriggerSpiralLock(spiralLock, currentCues)) {
      holdMessage("configured_cues");
      return;
    }
    setDecisionVisible(true);
  };

  const analyzeDraft = async (tone: RewriteTone = rewriteTone) => {
    if (isAnalyzingDraft) return;
    if (!body.trim()) {
      setSendFeedback("Write a message first, then choose Analyze draft. Nothing is analyzed automatically.");
      return;
    }
    if (!store.onboarding.analysisConsent) {
      setSendFeedback("Turn on AI analysis in Settings before sending this draft to Sadie.");
      return;
    }
    setRewriteTone(tone);
    setDraftAnalysis(undefined);
    setIsAnalyzingDraft(true);
    const result = await analyzeCurrentMessage({ body, recipient: recipient === "New message" ? "" : recipient, cues: currentCues, rewriteTone: tone });
    setIsAnalyzingDraft(false);
    if (!result) setSendFeedback("Sadie could not analyze this draft right now. Your message has not been sent or changed.");
    else setDraftAnalysis(result);
  };

  const applyDraftRewrite = () => {
    const rewrite = draftAnalysis?.gentleRewrite.trim();
    if (!rewrite) return;
    setBody(rewrite);
    setComposerStartedAt(Date.now());
    setDraftAnalysis(undefined);
    setSendFeedback("Sadie’s rewrite is now in your composer. It has not been sent; you can edit, hold, or discard it.");
  };

  const analyzeHistory = async () => {
    setIsAnalyzingHistory(true);
    const result = await analyzeConversationHistory({ participantLabel: recipient, messages: historyScope.messages });
    setIsAnalyzingHistory(false);
    if (!result) setSendFeedback("Sadie could not analyze this conversation right now. The conversation remains unchanged.");
    else setHistoryAnalysis(result);
  };

  const confirmHistoryAnalysis = () => {
    if (!historyScope.includedMessageCount) {
      setSendFeedback("There are no messages in this conversation to analyze yet.");
      return;
    }
    if (!store.onboarding.analysisConsent) {
      setSendFeedback("Turn on AI analysis in Settings before sending selected conversation text to Sadie.");
      return;
    }
    const scopeText = historyScope.truncated
      ? `Sadie will receive the newest ${historyScope.includedMessageCount} of ${historyScope.totalMessageCount} local messages from this conversation.`
      : `Sadie will receive all ${historyScope.includedMessageCount} local messages from this conversation.`;
    Alert.alert("Analyze this conversation?", `${scopeText} It will return an attachment-informed reflection on observable communication patterns, not labels or a diagnosis. Nothing is sent to the other person.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Analyze selected history", onPress: () => { void analyzeHistory(); } },
    ]);
  };

  const cancelTrustedSupport = () => {
    if (!supportCountdown) return;
    updateHeldMessageSupport(supportCountdown.heldId, { supportStatus: "cancelled" });
    setSupportCountdown(undefined);
    setSendFeedback("Trusted-contact support was cancelled. Your held message remains private and unsent.");
  };

  const releaseHeld = async (id: string) => {
    const held = store.smsClient.heldMessages.find((message) => message.id === id);
    if (!held) return;
    if (supportCountdown?.heldId === id) cancelTrustedSupport();
    const sent = await sendNativeSms({ address: held.address, body: held.body });
    if (sent) {
      removeHeldMessage(id);
      setSendFeedback("Held message queued with Android. Delivery status will update when reported.");
    } else {
      setSendFeedback(nativeReady ? "HoldOff could not queue the held message. It is still safely held." : "Activate the default SMS role before releasing a held message.");
    }
  };

  const discardHeld = (id: string) => {
    if (supportCountdown?.heldId === id) cancelTrustedSupport();
    removeHeldMessage(id);
    setSendFeedback("Held message discarded. It was not sent.");
  };

  const editHeld = (id: string) => {
    const held = store.smsClient.heldMessages.find((message) => message.id === id);
    if (!held) return;
    if (supportCountdown?.heldId === id) cancelTrustedSupport();
    setBody(held.body);
    setComposerStartedAt(Date.now());
    removeHeldMessage(id);
    setSendFeedback("Held message returned to the composer for editing. It was not sent.");
  };

  return (
    <VelvetScreen>
      <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={styles.keyboard}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Messages" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.topCopy}><Text numberOfLines={1} style={styles.title}>{recipient}</Text><Text style={styles.subtitle}>{nativeReady ? "SMS conversation" : "Native SMS activation required to send"}</Text></View>
        </View>

        {isNewConversation ? <View style={styles.recipientRow}><Text style={styles.toLabel}>To</Text><TextInput value={address} onChangeText={setAddress} keyboardType="phone-pad" placeholder="Phone number" placeholderTextColor={HOLD_OFF.muted} style={styles.recipientInput} /></View> : null}
        {sendFeedback ? <View accessibilityLiveRegion="polite" style={styles.feedback}><Text style={styles.feedbackText}>{sendFeedback}</Text></View> : null}
        {!isNewConversation ? <><SadieAssistant source="thread" inline /><View style={analysisStyles.actionRow}><SecondaryButton compact label={isAnalyzingHistory ? "Analyzing…" : "Analyze conversation"} onPress={confirmHistoryAnalysis} /></View></> : null}
        {historyAnalysis ? <View style={analysisStyles.card}><Text style={analysisStyles.eyebrow}>ATTACHMENT-INFORMED REFLECTION</Text><Text style={analysisStyles.title}>A reflection on this selected thread</Text><Text style={analysisStyles.text}>{historyAnalysis.summary}</Text>{historyAnalysis.patterns.map((pattern, index) => <Text key={`pattern-${index}`} style={analysisStyles.bullet}>• {pattern}</Text>)}{historyAnalysis.momentsToNotice.map((moment, index) => <Text key={`moment-${index}`} style={analysisStyles.bullet}>• {moment}</Text>)}<Text style={analysisStyles.next}>{historyAnalysis.nextStep}</Text>{historyAnalysis.immediateCare ? <Text style={analysisStyles.care}>If you might act on thoughts of harming yourself or someone else, call or text 988 in the US or contact local emergency services.</Text> : null}</View> : null}

        <FlatList
          data={thread}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <View style={[styles.bubble, item.direction === "outbound" ? styles.outbound : styles.inbound]}><Text style={styles.messageText}>{item.body}</Text><Text style={styles.messageMeta}>{timeLabel(item.createdAt)} · {deliveryLabel(item.status)}</Text></View>}
          ListHeaderComponent={heldMessages.length ? <View style={styles.heldGroup}>{heldMessages.map((held) => {
            const supportMessage = held.supportMessageId ? store.smsClient.messages.find((message) => message.id === `native-sms:${held.supportMessageId}`) : undefined;
            const supportDetail = held.supportStatus === "pending"
              ? "Trusted-contact support is waiting for the visible cancel window."
              : supportMessage
                ? `Trusted-contact support: ${deliveryLabel(supportMessage.status)}.`
                : held.supportStatus === "failed"
                  ? "Trusted-contact support was not queued. Your held message remains unsent."
                  : held.supportStatus === "cancelled"
                    ? "Trusted-contact support was cancelled. Your held message remains unsent."
                    : "This message has not been sent.";
            return <View key={held.id} style={styles.heldCard}><Text style={styles.heldEyebrow}>{held.reason === "configured_cues" ? "SPIRAL LOCK" : "HELD"}</Text><Text style={styles.heldBody}>{held.body}</Text><Text style={styles.heldDetail}>{supportDetail}</Text><View style={styles.heldActions}><View style={styles.heldAction}><PrimaryButton compact label="Release" onPress={() => { void releaseHeld(held.id); }} /></View><View style={styles.heldAction}><SecondaryButton compact label="Edit" onPress={() => editHeld(held.id)} /></View></View><SecondaryButton compact tone="danger" label="Discard held message" onPress={() => discardHeld(held.id)} /></View>;
          })}</View> : null}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No messages in this conversation yet.</Text><Text style={styles.emptyText}>{nativeReady ? "Write the first SMS below. HoldOff will show real receiver and delivery events here." : "This thread is ready to compose, but direct sending only becomes available in a rebuilt Android default-SMS installation."}</Text></View>}
        />

        {supportCountdown ? <View style={styles.supportBanner}><Text style={styles.supportTitle}>Trusted-contact support will send in {supportCountdown.secondsRemaining}s</Text><Text style={styles.supportText}>It is a separate check-in to {support.contactName || "your trusted contact"}; your held message is not included.</Text><SecondaryButton compact label="Cancel support message" onPress={cancelTrustedSupport} /></View> : null}
        {emotionalCues.length ? <View accessibilityLiveRegion="polite" style={analysisStyles.cueCard}><Text style={analysisStyles.cueTitle}>A local pause cue</Text><Text style={analysisStyles.cueText}>HoldOff noticed: {emotionalCues.map((cue) => cue.label.toLocaleLowerCase()).join(", ")}. This is not a diagnosis or a label. You can keep writing, analyze the draft, hold it, or send when you are ready.</Text></View> : null}
        {draftAnalysis ? <View style={analysisStyles.card}><Text style={analysisStyles.eyebrow}>DRAFT ANALYSIS</Text><Text style={analysisStyles.text}>{draftAnalysis.explanation}</Text>{draftAnalysis.signals.map((signal, index) => <Text key={`signal-${index}`} style={analysisStyles.bullet}>• {signal}</Text>)}{draftAnalysis.gentleRewrite ? <><Text style={analysisStyles.next}>{rewriteTone === "empathetic" ? "More empathetic rewrite" : rewriteTone === "direct" ? "More direct rewrite" : "Balanced rewrite"}: {draftAnalysis.gentleRewrite}</Text><PrimaryButton compact label="Use this rewrite" onPress={applyDraftRewrite} /><Text style={analysisStyles.toneLabel}>Try a different tone</Text><View style={analysisStyles.toneRow}><Pressable accessibilityRole="button" accessibilityLabel="Generate a more empathetic rewrite" onPress={() => { void analyzeDraft("empathetic"); }} style={({ pressed }) => [analysisStyles.toneChoice, rewriteTone === "empathetic" && analysisStyles.toneChoiceActive, pressed && styles.pressed]}><Text style={[analysisStyles.toneChoiceText, rewriteTone === "empathetic" && analysisStyles.toneChoiceTextActive]}>More empathetic</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Generate a more direct rewrite" onPress={() => { void analyzeDraft("direct"); }} style={({ pressed }) => [analysisStyles.toneChoice, rewriteTone === "direct" && analysisStyles.toneChoiceActive, pressed && styles.pressed]}><Text style={[analysisStyles.toneChoiceText, rewriteTone === "direct" && analysisStyles.toneChoiceTextActive]}>More direct</Text></Pressable></View></> : null}{draftAnalysis.immediateCare ? <Text style={analysisStyles.care}>If you might act on thoughts of harming yourself or someone else, call or text 988 in the US or contact local emergency services.</Text> : null}</View> : null}
        <View style={analysisStyles.composerTools}><SecondaryButton compact label={isAnalyzingDraft ? "Analyzing draft…" : "Analyze draft"} onPress={() => { void analyzeDraft(); }} /></View>
        <View style={styles.composer}><TextInput value={body} onFocus={() => setComposerStartedAt((current) => current ?? Date.now())} onChangeText={(value) => { setBody(value); setDraftAnalysis(undefined); }} placeholder="Message" placeholderTextColor={HOLD_OFF.muted} multiline style={styles.composerInput} /><Pressable accessibilityRole="button" accessibilityLabel="Review send options" onPress={onSendPress} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}><Text style={styles.sendText}>↑</Text></Pressable></View>
      </KeyboardAvoidingView>

      <Modal visible={decisionVisible} transparent animationType="fade" onRequestClose={() => setDecisionVisible(false)}>
        <View style={styles.modalBackdrop}><View style={styles.decisionSheet}><Text style={styles.decisionEyebrow}>AT THE SEND MOMENT</Text><Text style={styles.decisionTitle}>How would you like to move forward?</Text><Text style={styles.decisionText}>Your message has not been sent. You stay in control of what happens next.</Text><PrimaryButton label={nativeReady ? "Send now" : "Activate Android messenger"} onPress={() => { if (nativeReady) void sendMessage(); else router.push("/default-sms" as any); }} /><View style={styles.decisionGap} /><SecondaryButton label="Hold this message" onPress={() => holdMessage("user_hold")} />{spiralLock.enabled ? <><View style={styles.decisionGap} /><SecondaryButton label="Use Spiral Lock" onPress={() => holdMessage("configured_cues")} /></> : null}<View style={styles.decisionGap} /><SecondaryButton label="Keep editing" onPress={() => setDecisionVisible(false)} /></View></View>
      </Modal>
    </VelvetScreen>
  );
}

const analysisStyles = StyleSheet.create({
  actionRow: { alignItems: "flex-start", marginBottom: 5 },
  card: { padding: 13, gap: 7, marginBottom: 8, borderRadius: 17, backgroundColor: "rgba(103,214,177,0.08)", borderWidth: 1, borderColor: "rgba(103,214,177,0.38)" },
  eyebrow: { color: HOLD_OFF.moon, fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 0.9 },
  title: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 21, fontWeight: "800" },
  text: { color: HOLD_OFF.moon, fontSize: 13, lineHeight: 20 },
  bullet: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 18 },
  next: { color: HOLD_OFF.text, fontSize: 13, lineHeight: 20, fontWeight: "700", marginTop: 2 },
  care: { color: HOLD_OFF.gold, fontSize: 12, lineHeight: 18, marginTop: 3 },
  cueCard: { padding: 12, gap: 4, marginBottom: 8, borderRadius: 16, backgroundColor: "rgba(210,188,116,0.1)", borderWidth: 1, borderColor: "rgba(210,188,116,0.42)" },
  cueTitle: { color: HOLD_OFF.gold, fontSize: 13, lineHeight: 19, fontWeight: "800" },
  cueText: { color: HOLD_OFF.moon, fontSize: 12, lineHeight: 18 },
  toneLabel: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  toneRow: { flexDirection: "row", gap: 8 },
  toneChoice: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 9, borderRadius: 13, borderWidth: 1, borderColor: HOLD_OFF.border, backgroundColor: "rgba(61,42,102,0.28)" },
  toneChoiceActive: { borderColor: "rgba(184,166,240,0.7)", backgroundColor: "rgba(184,166,240,0.18)" },
  toneChoiceText: { color: HOLD_OFF.moon, fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "center" },
  toneChoiceTextActive: { color: HOLD_OFF.text },
  composerTools: { alignItems: "flex-start", marginTop: 2, marginBottom: 6 },
});

const styles = StyleSheet.create({
  keyboard: { flex: 1 }, topBar: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 10 }, backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(61,42,102,0.42)", borderWidth: 1, borderColor: HOLD_OFF.border }, backText: { color: HOLD_OFF.text, fontSize: 32, lineHeight: 34, marginTop: -4 }, topCopy: { flex: 1 }, title: { color: HOLD_OFF.text, fontSize: 19, lineHeight: 26, fontWeight: "800" }, subtitle: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 17, marginTop: 1 }, recipientRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 13, marginBottom: 8, backgroundColor: "#2A1A4A", borderRadius: 15, borderWidth: 1, borderColor: HOLD_OFF.border }, toLabel: { color: HOLD_OFF.lavender, fontSize: 14, fontWeight: "800" }, recipientInput: { flex: 1, color: HOLD_OFF.text, fontSize: 16, paddingVertical: 10 }, feedback: { borderRadius: 13, padding: 11, marginBottom: 8, backgroundColor: "rgba(184,166,240,0.13)", borderWidth: 1, borderColor: "rgba(184,166,240,0.38)" }, feedbackText: { color: HOLD_OFF.moon, fontSize: 13, lineHeight: 19 }, listContent: { gap: 8, paddingVertical: 8, flexGrow: 1 }, bubble: { maxWidth: "83%", paddingVertical: 10, paddingHorizontal: 13, borderRadius: 18 }, inbound: { alignSelf: "flex-start", backgroundColor: "#312052", borderWidth: 1, borderColor: HOLD_OFF.border }, outbound: { alignSelf: "flex-end", backgroundColor: HOLD_OFF.blue }, messageText: { color: HOLD_OFF.text, fontSize: 16, lineHeight: 23 }, messageMeta: { color: "rgba(245,242,255,0.72)", fontSize: 10, lineHeight: 15, marginTop: 4, textAlign: "right" }, heldGroup: { gap: 10, paddingBottom: 12 }, heldCard: { padding: 14, borderRadius: 18, backgroundColor: "rgba(210,188,116,0.1)", borderWidth: 1, borderColor: "rgba(210,188,116,0.46)", gap: 8 }, heldEyebrow: { color: HOLD_OFF.gold, fontSize: 10, lineHeight: 14, letterSpacing: 1, fontWeight: "800" }, heldBody: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 22 }, heldDetail: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 18 }, heldActions: { flexDirection: "row", gap: 8 }, heldAction: { flex: 1 }, empty: { alignSelf: "center", maxWidth: 290, paddingVertical: 32, paddingHorizontal: 18, alignItems: "center" }, emptyTitle: { color: HOLD_OFF.text, fontSize: 17, lineHeight: 24, fontWeight: "800", textAlign: "center" }, emptyText: { color: HOLD_OFF.muted, fontSize: 14, lineHeight: 21, marginTop: 6, textAlign: "center" }, supportBanner: { marginVertical: 8, padding: 13, gap: 6, borderRadius: 17, backgroundColor: "rgba(184,166,240,0.16)", borderWidth: 1, borderColor: "rgba(184,166,240,0.5)" }, supportTitle: { color: HOLD_OFF.text, fontSize: 14, lineHeight: 20, fontWeight: "800" }, supportText: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 18 }, composer: { flexDirection: "row", alignItems: "flex-end", gap: 9, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: HOLD_OFF.border }, composerInput: { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 18, color: HOLD_OFF.text, backgroundColor: "#2A1A4A", borderWidth: 1, borderColor: HOLD_OFF.border, paddingHorizontal: 13, paddingVertical: 12, fontSize: 16, lineHeight: 22 }, sendButton: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: HOLD_OFF.violet }, sendText: { color: HOLD_OFF.text, fontSize: 25, lineHeight: 29, fontWeight: "800" }, modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(9,4,20,0.62)" }, decisionSheet: { padding: 20, paddingBottom: 30, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#21143A", borderWidth: 1, borderColor: HOLD_OFF.border }, decisionEyebrow: { color: HOLD_OFF.lavender, fontSize: 11, lineHeight: 16, letterSpacing: 1, fontWeight: "800" }, decisionTitle: { color: HOLD_OFF.text, fontSize: 23, lineHeight: 30, fontWeight: "800", marginTop: 6 }, decisionText: { color: HOLD_OFF.muted, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 18 }, decisionGap: { height: 9 }, pressed: { transform: [{ scale: 0.975 }], opacity: 0.9 },
});
