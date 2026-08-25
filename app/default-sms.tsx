import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { PageHeader, PrimaryButton, SecondaryButton, SectionCard, VelvetScreen } from "@/components/holdoff-ui";
import { useHoldOff } from "@/components/holdoff-provider";
import { SmsPermissionDenialGuidance } from "@/components/sms-permission-denial-guidance";
import { HOLD_OFF } from "@/constants/holdoff-theme";
import { nativeSmsClient } from "@/services/native-sms-client";

function CheckRow({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}>
      <View style={[styles.box, checked && styles.boxOn]}><Text style={styles.tick}>{checked ? "✓" : ""}</Text></View>
      <Text style={styles.checkText}>{label}</Text>
    </Pressable>
  );
}

function RoleRequirements() {
  return (
    <SectionCard>
      <View style={styles.requirement}><Text style={styles.requirementNumber}>1</Text><View style={styles.requirementCopy}><Text style={styles.requirementTitle}>A private message inbox</Text><Text style={styles.requirementText}>On-device conversation storage, incoming-message delivery, read state, and notifications.</Text></View></View>
      <View style={styles.requirement}><Text style={styles.requirementNumber}>2</Text><View style={styles.requirementCopy}><Text style={styles.requirementTitle}>A system role request</Text><Text style={styles.requirementText}>Android’s chooser asks whether you want HoldOff to replace the current SMS app. HoldOff cannot silently become default.</Text></View></View>
      <View style={styles.requirement}><Text style={styles.requirementNumber}>3</Text><View style={styles.requirementCopy}><Text style={styles.requirementTitle}>Permission and privacy controls</Text><Text style={styles.requirementText}>Messaging permissions stay off until Android confirms the default-SMS role first.</Text></View></View>
    </SectionCard>
  );
}

export default function DefaultSmsScreen() {
  const router = useRouter();
  const { store, updateSmsClientFoundation } = useHoldOff();
  const sms = store.smsClient;
  const [activating, setActivating] = useState(false);
  const [permissionUpdated, setPermissionUpdated] = useState(false);
  const leftForeground = useRef(false);

  const refreshRole = useCallback(async (announceNewPermissions = false) => {
    if (Platform.OS !== "android") return null;
    const state = await nativeSmsClient.getRoleState();
    if (!state) return null;
    const permissions = state.active ? await nativeSmsClient.getMessagingPermissionState() : null;
    const newlyGranted = Boolean(permissions?.allGranted && sms.permissionStatus !== "granted");
    updateSmsClientFoundation({
      roleStatus: state.active ? "active" : state.available ? "not_requested" : "not_available",
      permissionStatus: permissions?.allGranted ? "granted" : permissions && sms.permissionStatus === "requested" ? "denied" : sms.permissionStatus,
      lastRoleCheckAt: new Date().toISOString(),
    });
    if (announceNewPermissions && newlyGranted) setPermissionUpdated(true);
    return state;
  }, [sms.permissionStatus, updateSmsClientFoundation]);

  useEffect(() => { void refreshRole(); }, [refreshRole]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") leftForeground.current = true;
      if (nextState === "active" && leftForeground.current) {
        leftForeground.current = false;
        void refreshRole(true);
      }
    });
    return () => subscription.remove();
  }, [refreshRole]);

  useEffect(() => {
    if (!permissionUpdated) return;
    const timer = setTimeout(() => setPermissionUpdated(false), 4200);
    return () => clearTimeout(timer);
  }, [permissionUpdated]);

  const requestRole = async () => {
    if (Platform.OS !== "android") {
      Alert.alert("Android only", "The default SMS role is available only in an installed Android build.");
      return;
    }
    setActivating(true);
    try {
      const state = await refreshRole();
      if (!state) {
        updateSmsClientFoundation({ roleStatus: "native_build_required", lastRoleCheckAt: new Date().toISOString() });
        Alert.alert("Native Android build required", "This preview does not include HoldOff’s native SMS role bridge. Install a rebuilt Android version to open Android’s role chooser.");
      } else if (!state.available) {
        updateSmsClientFoundation({ roleStatus: "not_available", lastRoleCheckAt: new Date().toISOString() });
        Alert.alert("SMS role unavailable", "This Android device does not currently offer the system default-SMS role.");
      } else if (state.active) {
        updateSmsClientFoundation({ roleStatus: "active", lastRoleCheckAt: new Date().toISOString() });
        Alert.alert("HoldOff is already selected", "Android reports that HoldOff currently holds the default SMS role.");
      } else if (await nativeSmsClient.requestRole()) {
        updateSmsClientFoundation({ roleStatus: "role_requested", lastRoleCheckAt: new Date().toISOString() });
        Alert.alert("Android role chooser opened", "Review Android’s system prompt. When you return, refresh the SMS role status to confirm your choice.");
      } else {
        updateSmsClientFoundation({ roleStatus: "native_build_required", lastRoleCheckAt: new Date().toISOString() });
        Alert.alert("Native Android build required", "This preview cannot open Android’s SMS role chooser.");
      }
    } catch {
      updateSmsClientFoundation({ roleStatus: "not_requested", lastRoleCheckAt: new Date().toISOString() });
      Alert.alert("Couldn’t open the role chooser", "Your current messaging app remains unchanged. Try again from a rebuilt Android HoldOff app.");
    } finally {
      setActivating(false);
    }
  };

  const requestMessagingPermissions = async () => {
    if (Platform.OS !== "android") return;
    setActivating(true);
    try {
      const role = await refreshRole();
      if (!role?.active) {
        Alert.alert("Choose HoldOff first", "Android must confirm HoldOff as your default SMS app before HoldOff can request messaging permissions.");
        return;
      }
      const result = await nativeSmsClient.requestMessagingPermissions();
      if (!result) {
        Alert.alert("Native Android build required", "This preview cannot request SMS permissions.");
      } else if (!result.requested) {
        updateSmsClientFoundation({ permissionStatus: "granted", lastRoleCheckAt: new Date().toISOString() });
        Alert.alert("Messaging permissions already active", "Android reports that all currently required messaging permissions are granted.");
      } else {
        updateSmsClientFoundation({ permissionStatus: "requested", lastRoleCheckAt: new Date().toISOString() });
        Alert.alert("Android permission prompts opened", "Choose the permissions you want to grant. Return here and refresh the status afterward.");
      }
    } catch {
      updateSmsClientFoundation({ permissionStatus: "denied", lastRoleCheckAt: new Date().toISOString() });
      Alert.alert("Permissions weren’t requested", "HoldOff kept SMS access off because Android has not confirmed the required role or permission request.");
    } finally {
      setActivating(false);
    }
  };

  const active = sms.roleStatus === "active";
  const canRequestRole = sms.activationAcknowledged && sms.privacyPolicyAcknowledged && Platform.OS === "android" && !activating;
  const roleLabel = active ? "DEFAULT SMS ACTIVE" : sms.roleStatus === "role_requested" ? "ROLE REQUEST AWAITING CHOICE" : "NOT ACTIVE IN THIS BUILD";

  return (
    <VelvetScreen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.top}><Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable></View>
        <PageHeader eyebrow="Android-first SMS messenger" title="Make HoldOff your default SMS app" subtitle="Only when you want it to take responsibility for your messages." />
        {permissionUpdated ? <View accessibilityLiveRegion="polite" style={styles.statusToast}><Text style={styles.statusToastTitle}>Status updated</Text><Text style={styles.statusToastText}>Messaging permissions are now active. HoldOff can use the SMS features you approved.</Text></View> : null}
        <SectionCard style={active ? styles.activeCard : undefined}>
          <Text style={styles.stateLabel}>{roleLabel}</Text>
          <Text style={styles.cardTitle}>{active ? "HoldOff is handling your SMS role." : "Your current messaging app stays in control."}</Text>
          <Text style={styles.cardBody}>{active ? "Android confirms HoldOff’s SMS role. You can now choose whether to grant messaging permissions." : "HoldOff will open Android’s system chooser only from a rebuilt Android app with the native SMS role bridge included."}</Text>
        </SectionCard>
        <Text style={styles.sectionTitle}>What a complete Android edition includes</Text>
        <RoleRequirements />
        <Text style={styles.sectionTitle}>Your activation choices</Text>
        <SectionCard>
          <CheckRow checked={sms.activationAcknowledged} label="I understand that making HoldOff default replaces my current SMS app for sending and receiving messages." onPress={() => updateSmsClientFoundation({ activationAcknowledged: !sms.activationAcknowledged })} />
          <CheckRow checked={sms.privacyPolicyAcknowledged} label="I understand that a default-SMS edition must process message content on this device to show conversations and notifications." onPress={() => updateSmsClientFoundation({ privacyPolicyAcknowledged: !sms.privacyPolicyAcknowledged })} />
          <Text style={styles.note}>{Platform.OS === "android" ? "Android will not show messaging permission prompts until it confirms HoldOff’s default-SMS role." : "The Android default-SMS role is unavailable on this platform."}</Text>
          <PrimaryButton label={activating ? "Checking Android role…" : "Request Android default-SMS role"} onPress={requestRole} disabled={!canRequestRole} />
          {active ? <><View style={styles.gap} /><PrimaryButton label={activating ? "Checking permissions…" : sms.permissionStatus === "granted" ? "Messaging permissions active" : "Grant messaging permissions"} onPress={requestMessagingPermissions} disabled={activating || sms.permissionStatus === "granted"} /></> : null}
          <View style={styles.gap} /><SecondaryButton label="Refresh SMS role status" onPress={() => { void refreshRole(); }} />
          <View style={styles.gap} /><SecondaryButton label="Keep my current messaging app" onPress={() => router.back()} />
        </SectionCard>
        {sms.permissionStatus === "denied" ? <SmsPermissionDenialGuidance onRetry={requestMessagingPermissions} onKeepManual={() => router.back()} /> : null}
        <View style={styles.privacy}><Text style={styles.privacyTitle}>Privacy boundary today</Text><Text style={styles.privacyText}>Until Android confirms the default role and you grant the subsequent permission prompts, HoldOff cannot read your SMS inbox, receive new messages, or become your default handler.</Text></View>
      </ScrollView>
    </VelvetScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: 24, paddingBottom: 34, gap: 14 }, top: { height: 44, justifyContent: "center" }, back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: HOLD_OFF.border, alignItems: "center", justifyContent: "center" }, backText: { color: HOLD_OFF.lavender, fontSize: 31, lineHeight: 34, marginTop: -4 }, statusToast: { padding: 14, borderRadius: 17, borderWidth: 1, borderColor: "rgba(103,214,177,0.56)", backgroundColor: "#213E48" }, statusToastTitle: { color: HOLD_OFF.coolGreen, fontSize: 14, lineHeight: 20, fontWeight: "800" }, statusToastText: { color: HOLD_OFF.text, fontSize: 13, lineHeight: 20, marginTop: 3 }, stateLabel: { color: HOLD_OFF.lavender, fontSize: 11, lineHeight: 16, letterSpacing: 0.9, fontWeight: "800" }, cardTitle: { color: HOLD_OFF.text, fontSize: 20, lineHeight: 27, fontWeight: "700", marginTop: 5 }, cardBody: { color: HOLD_OFF.muted, fontSize: 15, lineHeight: 23, marginTop: 7 }, activeCard: { borderColor: "rgba(103,214,177,0.52)", backgroundColor: "#213E48" }, sectionTitle: { color: HOLD_OFF.lavender, fontSize: 12, lineHeight: 17, letterSpacing: 0.9, fontWeight: "800", textTransform: "uppercase", marginTop: 5 }, requirement: { flexDirection: "row", gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(61,42,102,0.67)" }, requirementNumber: { color: HOLD_OFF.lavender, fontSize: 16, lineHeight: 22, fontWeight: "800" }, requirementCopy: { flex: 1 }, requirementTitle: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, requirementText: { color: HOLD_OFF.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }, checkRow: { flexDirection: "row", gap: 12, minHeight: 61, alignItems: "center", paddingVertical: 8 }, box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: HOLD_OFF.lavender, alignItems: "center", justifyContent: "center" }, boxOn: { backgroundColor: HOLD_OFF.violet, borderColor: HOLD_OFF.violet }, tick: { color: HOLD_OFF.text, fontSize: 15, fontWeight: "800" }, checkText: { flex: 1, color: HOLD_OFF.text, fontSize: 14, lineHeight: 21 }, note: { color: HOLD_OFF.gold, fontSize: 13, lineHeight: 19, marginVertical: 7 }, gap: { height: 10 }, privacy: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: "rgba(184,166,240,0.3)", backgroundColor: "rgba(184,166,240,0.1)" }, privacyTitle: { color: HOLD_OFF.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, privacyText: { color: HOLD_OFF.muted, fontSize: 13, lineHeight: 20, marginTop: 4 }, pressed: { transform: [{ scale: 0.98 }], opacity: 0.86 },
});
