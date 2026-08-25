import { useMemo } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";

import { PageHeader, SadieAssistant, SectionCard, VelvetScreen } from "@/components/holdoff-ui";
import { useHoldOff } from "@/components/holdoff-provider";
import { HOLD_OFF } from "@/constants/holdoff-theme";
import { formatShortDate, timeWindowLabel } from "@/lib/holdoff-utils";

export default function PatternsScreen() {
  const { store } = useHoldOff();
  const events = useMemo(() => store.moodEvents.slice(0, 14).reverse(), [store.moodEvents]);
  const riskWindows = useMemo(() => {
    const groups = new Map<string, number[]>();
    store.moodEvents.forEach((event) => { const label = timeWindowLabel(event.createdAt); groups.set(label, [...(groups.get(label) ?? []), event.score]); });
    return [...groups.entries()].map(([label, scores]) => ({ label, average: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length), count: scores.length })).sort((a, b) => b.average - a.average);
  }, [store.moodEvents]);
  const peopleSignals = useMemo(() => store.people.map((person) => ({ person, count: store.moodEvents.filter((event) => event.personId === person.id && event.score >= 55).length })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count), [store.moodEvents, store.people]);
  const trend = useMemo(() => {
    if (events.length < 3) return null;
    const half = Math.floor(events.length / 2);
    const early = events.slice(0, half).reduce((sum, item) => sum + item.score, 0) / half;
    const recent = events.slice(half).reduce((sum, item) => sum + item.score, 0) / (events.length - half);
    if (Math.abs(recent - early) < 7) return "Your recent writing looks fairly steady compared with earlier saved moments.";
    return recent < early ? "Your recent writing has carried a little less activation than earlier saved moments." : "Your recent writing has carried a little more activation than earlier saved moments.";
  }, [events]);

  if (!store.onboarding.moodLearningConsent) return <VelvetScreen><ScrollView contentContainerStyle={styles.scroll}><PageHeader eyebrow="Inferred, never rated" title="Patterns stay private." subtitle="Writing-based pattern learning is currently off." /><SectionCard><Text style={styles.emptyTitle}>Nothing is being tracked here.</Text><Text style={styles.emptyText}>If you choose to turn on mood pattern learning in Settings, HoldOff can summarize writing-based signals from saved drafts and Sadie chats. It never asks you to rate your mood.</Text></SectionCard></ScrollView><SadieAssistant /></VelvetScreen>;

  return <VelvetScreen><ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><PageHeader eyebrow="Inferred, never rated" title="Patterns in your writing" subtitle="Inferred from your writing — I never ask you to rate your mood." />{!events.length ? <SectionCard><Text style={styles.emptyTitle}>Your timeline will appear gently.</Text><Text style={styles.emptyText}>Once you’ve held a few messages or talked with Sadie, this view will reflect only the moments you’ve chosen to save.</Text></SectionCard> : <><SectionCard><Text style={styles.cardTitle}>Writing activation over time</Text><Text style={styles.cardCaption}>Each point is an inference from a saved draft or Sadie chat, not a diagnosis.</Text><FlatList horizontal data={events} keyExtractor={(event) => event.id} contentContainerStyle={styles.chart} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <View style={styles.barColumn}><View style={styles.barTrack}><View style={[styles.bar, { height: Math.max(22, Math.round(item.score * 0.95)) }]} /></View><Text style={styles.barLabel}>{formatShortDate(item.createdAt)}</Text></View>} /></SectionCard>{riskWindows.length ? <SectionCard><Text style={styles.cardTitle}>When writing feels more charged</Text><Text style={styles.cardCaption}>These windows are based on your saved writing only.</Text>{riskWindows.slice(0, 3).map((window) => <View key={window.label} style={styles.patternRow}><View><Text style={styles.patternName}>{window.label}</Text><Text style={styles.patternSub}>{window.count} saved {window.count === 1 ? "moment" : "moments"}</Text></View><Text style={styles.patternScore}>{window.average}/100</Text></View>)}</SectionCard> : null}{peopleSignals.length ? <SectionCard><Text style={styles.cardTitle}>People linked with held moments</Text><Text style={styles.cardCaption}>This is context for reflection, not a verdict about anyone.</Text>{peopleSignals.slice(0, 3).map(({ person, count }) => <View key={person.id} style={styles.patternRow}><View><Text style={styles.patternName}>{person.name}</Text><Text style={styles.patternSub}>{person.relationship}</Text></View><Text style={styles.patternScore}>{count} held</Text></View>)}</SectionCard> : null}{trend ? <SectionCard style={styles.trendCard}><Text style={styles.cardTitle}>A small trend</Text><Text style={styles.trendText}>{trend}</Text></SectionCard> : null}</>}</ScrollView><SadieAssistant /></VelvetScreen>;
}

const styles = StyleSheet.create({
  scroll: { paddingTop: 6, paddingBottom: 112, gap: 14 }, emptyTitle: { color: HOLD_OFF.text, fontSize: 19, lineHeight: 26, fontWeight: "700" }, emptyText: { color: HOLD_OFF.muted, fontSize: 15, lineHeight: 23, marginTop: 7 }, cardTitle: { color: HOLD_OFF.text, fontSize: 18, lineHeight: 25, fontWeight: "700" }, cardCaption: { color: HOLD_OFF.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }, chart: { gap: 13, paddingTop: 20, paddingRight: 8, minHeight: 143 }, barColumn: { width: 31, alignItems: "center", justifyContent: "flex-end" }, barTrack: { height: 98, justifyContent: "flex-end", width: 18, backgroundColor: "rgba(61,42,102,0.44)", borderRadius: 9, overflow: "hidden" }, bar: { width: "100%", borderRadius: 9, backgroundColor: HOLD_OFF.violet }, barLabel: { color: HOLD_OFF.muted, fontSize: 10, lineHeight: 14, marginTop: 7 }, patternRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, borderTopWidth: 1, borderTopColor: "rgba(61,42,102,0.7)", marginTop: 12 }, patternName: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, patternSub: { color: HOLD_OFF.muted, fontSize: 12, lineHeight: 17, marginTop: 2 }, patternScore: { color: HOLD_OFF.lavender, fontSize: 13, lineHeight: 18, fontWeight: "800" }, trendCard: { backgroundColor: "rgba(67,97,238,0.14)", borderColor: "rgba(184,166,240,0.36)" }, trendText: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 23, marginTop: 7 },
});
