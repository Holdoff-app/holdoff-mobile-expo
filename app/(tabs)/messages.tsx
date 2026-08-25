import { useEffect, useMemo, useState } from "react";
import { AppState, FlatList, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from "react-native";
import { useRouter } from "expo-router";

import { PageHeader, PrimaryButton, SadieAssistant, SecondaryButton, SectionCard, VelvetScreen } from "@/components/holdoff-ui";
import { useHoldOff } from "@/components/holdoff-provider";
import { HOLD_OFF } from "@/constants/holdoff-theme";
import { filterConversations, splitSearchMatch } from "@/lib/conversation-search";

function stateDescription(roleStatus: string, permissionStatus: string): { title: string; body: string; action: string } {
  if (roleStatus === "active" && permissionStatus === "granted") return { title: "HoldOff is ready for SMS", body: "Incoming messages and system delivery updates will appear here as Android reports them. Nothing is invented for this inbox.", action: "New message" };
  return { title: "Activate the Android messenger", body: "This preview does not read or send SMS. In a rebuilt Android installation, choose HoldOff as the default SMS app first, then grant messaging access.", action: "Review activation" };
}

function HighlightedText({ value, query, style, highlightStyle, numberOfLines = 1 }: { value: string; query: string; style: StyleProp<TextStyle>; highlightStyle: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text numberOfLines={numberOfLines} style={style}>{splitSearchMatch(value, query).map((segment, index) => <Text key={`${segment.text}-${index}`} style={segment.matched ? highlightStyle : undefined}>{segment.text}</Text>)}</Text>;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { store, syncNativeSmsEvents, syncDeviceSmsHistory, resolveConversationContactNames, clearConversationContactNames } = useHoldOff();
  const { smsClient } = store;
  const state = stateDescription(smsClient.roleStatus, smsClient.permissionStatus);
  const nativeReady = smsClient.roleStatus === "active" && smsClient.permissionStatus === "granted";
  const conversations = useMemo(() => [...smsClient.conversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)), [smsClient.conversations]);
  const [historyFeedback, setHistoryFeedback] = useState<string>();
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [search, setSearch] = useState("");
  const [contactFeedback, setContactFeedback] = useState<string>();
  const [resolvingContacts, setResolvingContacts] = useState(false);
  const filteredConversations = useMemo(() => filterConversations(conversations, smsClient.messages, search), [conversations, search, smsClient.messages]);
  const hasResolvedContactNames = conversations.some((conversation) => Boolean(conversation.displayName));

  useEffect(() => {
    void syncNativeSmsEvents();
    const subscription = AppState.addEventListener("change", (appState) => {
      if (appState === "active") void syncNativeSmsEvents();
    });
    return () => subscription.remove();
  }, [syncNativeSmsEvents]);

  const loadDeviceHistory = async () => {
    if (!nativeReady || loadingHistory) return;
    setLoadingHistory(true);
    const count = await syncDeviceSmsHistory();
    setHistoryFeedback(count ? `Checked ${count} local SMS record${count === 1 ? "" : "s"}; matching messages were merged without duplicates.` : "No local SMS history was returned. Check the Android role and messaging permissions if you expected messages here.");
    setLoadingHistory(false);
  };

  const resolveContactNames = async () => {
    if (resolvingContacts) return;
    setResolvingContacts(true);
    const result = await resolveConversationContactNames();
    if (result.status === "granted") {
      setContactFeedback(result.resolvedCount ? `Showing ${result.resolvedCount} contact name${result.resolvedCount === 1 ? "" : "s"} from this device.` : "No matching contact names were found. Phone numbers remain visible.");
    } else if (result.status === "denied") {
      setContactFeedback("Contact access was not granted. HoldOff will keep showing phone numbers.");
    } else {
      setContactFeedback("Contact name lookup is unavailable in this build. Phone numbers remain visible.");
    }
    setResolvingContacts(false);
  };

  return <VelvetScreen><FlatList
    data={filteredConversations}
    keyExtractor={(item) => item.id}
    contentContainerStyle={styles.list}
    showsVerticalScrollIndicator={false}
    ListHeaderComponent={<><PageHeader eyebrow="Android-first messenger" title="Messages" subtitle="Your conversations stay on this device unless you choose to share text for help." /><SectionCard style={[styles.statusCard, nativeReady && styles.readyCard]}><Text style={styles.stateLabel}>{nativeReady ? "DEFAULT SMS ACTIVE" : "NATIVE BUILD REQUIRED"}</Text><Text style={styles.statusTitle}>{state.title}</Text><Text style={styles.statusText}>{state.body}</Text><PrimaryButton label={state.action} onPress={() => nativeReady ? router.push("/conversation/new" as any) : router.push("/default-sms" as any)} />{nativeReady ? <><View style={styles.actionGap} /><SecondaryButton label={loadingHistory ? "Loading local SMS history…" : "Load local SMS history"} onPress={() => { void loadDeviceHistory(); }} /><Text style={styles.historyNote}>Only load history you want HoldOff to keep on this device. This action never sends it to Sadie automatically.</Text></> : null}</SectionCard>{historyFeedback ? <View accessibilityLiveRegion="polite" style={styles.historyFeedback}><Text style={styles.historyFeedbackText}>{historyFeedback}</Text></View> : null}{conversations.length ? <SectionCard style={styles.contactCard}><Text style={styles.contactTitle}>Names from your contacts</Text><Text style={styles.contactText}>Optional. HoldOff asks only when you choose this and stores matching conversation labels on this device.</Text><SecondaryButton label={resolvingContacts ? "Checking contacts…" : "Show contact names"} onPress={() => { void resolveContactNames(); }} />{hasResolvedContactNames ? <><View style={styles.actionGap} /><SecondaryButton tone="danger" label="Show phone numbers instead" onPress={() => { clearConversationContactNames(); setContactFeedback("Contact names were removed from HoldOff. Phone numbers are shown again."); }} /></> : null}</SectionCard> : null}{contactFeedback ? <View accessibilityLiveRegion="polite" style={styles.contactFeedback}><Text style={styles.contactFeedbackText}>{contactFeedback}</Text></View> : null}{smsClient.heldMessages.length ? <View style={styles.holdSummary}><Text style={styles.holdSummaryText}>{smsClient.heldMessages.length} {smsClient.heldMessages.length === 1 ? "message is" : "messages are"} held locally. Open the conversation to review, release, edit, or discard.</Text></View> : null}<Text style={styles.sectionTitle}>Conversations</Text><View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search names, numbers, or messages" placeholderTextColor={HOLD_OFF.muted} style={styles.searchInput} returnKeyType="search" accessibilityLabel="Search conversations" />{search ? <Pressable accessibilityRole="button" accessibilityLabel="Clear conversation search" onPress={() => setSearch("")} style={({ pressed }) => [styles.clearSearch, pressed && styles.pressed]}><Text style={styles.clearSearchText}>×</Text></Pressable> : null}</View></>}
    renderItem={({ item }) => {
      const latest = smsClient.messages.filter((message) => message.conversationId === item.id).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
      const held = smsClient.heldMessages.some((message) => message.conversationId === item.id);
      const label = item.displayName ?? item.address;
      const preview = held ? "Held message ready to review" : latest ? `${latest.direction === "outbound" ? `${latest.status === "failed" ? "Not sent" : latest.status}: ` : ""}${latest.body}` : "No messages loaded yet";
      return <Pressable accessibilityRole="button" accessibilityLabel={`Open conversation with ${label}`} onPress={() => router.push({ pathname: "/conversation/[address]" as any, params: { address: item.address } })} style={({ pressed }) => [styles.conversation, pressed && styles.pressed]}><View style={styles.avatar}><Text style={styles.avatarText}>{label.slice(0, 1).toUpperCase()}</Text></View><View style={styles.conversationCopy}><View style={styles.nameLine}><HighlightedText value={label} query={search} style={styles.conversationName} highlightStyle={highlightStyles.name} />{item.unreadCount ? <View style={styles.unread}><Text style={styles.unreadText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text></View> : null}</View>{item.displayName ? <HighlightedText value={item.address} query={search} style={styles.conversationAddress} highlightStyle={highlightStyles.address} /> : null}<HighlightedText value={preview} query={search} style={styles.preview} highlightStyle={highlightStyles.preview} /></View></Pressable>;
    }}
    ListEmptyComponent={<SectionCard><Text style={styles.emptyTitle}>{search.trim() ? "No matching conversations." : "No SMS conversations are loaded."}</Text><Text style={styles.emptyText}>{search.trim() ? "Try a different name, phone number, or message phrase." : nativeReady ? "HoldOff is waiting for actual Android receiver events or a message you choose to compose." : "This is intentional until an Android default-SMS build has the system role and messaging permissions."}</Text></SectionCard>}
    ListFooterComponent={<><View style={styles.boundary}><Text style={styles.boundaryTitle}>HoldOff at the send moment</Text><Text style={styles.boundaryText}>The conversation composer gives you a visible chance to send, hold, or revise. Spiral Lock only holds messages when you enable it in advance.</Text></View><View style={styles.footerSpace} /></>}
  /><SadieAssistant /></VelvetScreen>;
}

const styles = StyleSheet.create({
  list: { paddingTop: 6, paddingBottom: 112, gap: 12 }, statusCard: { borderColor: "rgba(184,166,240,0.54)", backgroundColor: "#2B1B50", gap: 9 }, readyCard: { borderColor: "rgba(103,214,177,0.5)", backgroundColor: "rgba(23,70,66,0.58)" }, stateLabel: { color: HOLD_OFF.lavender, fontSize: 11, lineHeight: 16, fontWeight: "800", letterSpacing: 0.8 }, statusTitle: { color: HOLD_OFF.text, fontSize: 20, lineHeight: 27, fontWeight: "700" }, statusText: { color: HOLD_OFF.muted, fontSize: 15, lineHeight: 23 }, actionGap: { height: 8 }, historyNote: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 18 }, historyFeedback: { padding: 11, borderRadius: 14, borderWidth: 1, borderColor: "rgba(103,214,177,0.38)", backgroundColor: "rgba(103,214,177,0.09)" }, historyFeedbackText: { color: HOLD_OFF.moon, fontSize: 13, lineHeight: 19 }, contactCard: { gap: 9 }, contactTitle: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 21, fontWeight: "800" }, contactText: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 18 }, contactFeedback: { padding: 11, borderRadius: 14, borderWidth: 1, borderColor: "rgba(184,166,240,0.38)", backgroundColor: "rgba(184,166,240,0.1)" }, contactFeedbackText: { color: HOLD_OFF.moon, fontSize: 13, lineHeight: 19 }, holdSummary: { padding: 12, borderRadius: 14, backgroundColor: "rgba(210,188,116,0.11)", borderWidth: 1, borderColor: "rgba(210,188,116,0.42)" }, holdSummaryText: { color: HOLD_OFF.moon, fontSize: 13, lineHeight: 19 }, sectionTitle: { color: HOLD_OFF.lavender, fontSize: 12, lineHeight: 17, letterSpacing: 0.9, fontWeight: "800", textTransform: "uppercase", marginTop: 4 }, searchBox: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#2A1A4A", borderWidth: 1, borderColor: HOLD_OFF.border }, searchIcon: { color: HOLD_OFF.lavender, fontSize: 22, lineHeight: 26, marginRight: 7 }, searchInput: { flex: 1, color: HOLD_OFF.text, fontSize: 15, paddingVertical: 10 }, clearSearch: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(184,166,240,0.15)" }, clearSearchText: { color: HOLD_OFF.lavender, fontSize: 22, lineHeight: 24 }, conversation: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 74, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: HOLD_OFF.border, backgroundColor: "rgba(36,22,64,0.74)" }, avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(123,94,231,0.28)", borderWidth: 1, borderColor: "rgba(184,166,240,0.35)" }, avatarText: { color: HOLD_OFF.lavender, fontSize: 17, lineHeight: 22, fontWeight: "800" }, conversationCopy: { flex: 1, minWidth: 0 }, nameLine: { flexDirection: "row", alignItems: "center", gap: 8 }, conversationName: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 21, fontWeight: "700", flexShrink: 1 }, conversationAddress: { color: HOLD_OFF.muted, fontSize: 11, lineHeight: 16, marginTop: 1 }, unread: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: HOLD_OFF.violet }, unreadText: { color: HOLD_OFF.text, fontSize: 10, lineHeight: 13, fontWeight: "800" }, preview: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 18, marginTop: 2 }, emptyTitle: { color: HOLD_OFF.text, fontSize: 18, lineHeight: 25, fontWeight: "700" }, emptyText: { color: HOLD_OFF.muted, fontSize: 14, lineHeight: 21, marginTop: 6 }, boundary: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: "rgba(184,166,240,0.3)", backgroundColor: "rgba(184,166,240,0.1)", marginTop: 2 }, boundaryTitle: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, boundaryText: { color: HOLD_OFF.muted, fontSize: 13, lineHeight: 20, marginTop: 4 }, footerSpace: { height: 44 }, pressed: { transform: [{ scale: 0.98 }], opacity: 0.86 },
});

const highlightStyles = StyleSheet.create({
  name: { color: HOLD_OFF.gold, backgroundColor: "rgba(210,188,116,0.18)", fontWeight: "800" },
  address: { color: HOLD_OFF.moon, backgroundColor: "rgba(184,166,240,0.2)", fontWeight: "800" },
  preview: { color: HOLD_OFF.text, backgroundColor: "rgba(103,214,177,0.16)", fontWeight: "800" },
});
