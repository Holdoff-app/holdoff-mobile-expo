import AsyncStorage from "@react-native-async-storage/async-storage";

import type { HoldOffStore } from "@/lib/holdoff-types";

export const HOLD_OFF_STORAGE_KEY = "holdoff.local.v1";

export const createEmptyStore = (): HoldOffStore => ({
  version: 1,
  onboarding: {
    completed: false,
    step: 0,
    ageConfirmed: false,
    capabilityAcknowledged: false,
    supportAcknowledged: false,
    analysisConsent: false,
    moodLearningConsent: false,
  },
  drafts: [],
  interpretations: [],
  importedThreads: [],
  smsClient: {
    roleStatus: "not_requested",
    permissionStatus: "not_requested",
    activationAcknowledged: false,
    privacyPolicyAcknowledged: false,
    conversations: [],
    messages: [],
    heldMessages: [],
    spiralLock: {
      enabled: false,
      emotionalCueCheckEnabled: false,
      triggerAllCaps: true,
      triggerRepeatedPunctuation: true,
      triggerRapidTyping: true,
      trustedContactSupport: {
        enabled: false,
        acknowledged: false,
        contactName: "",
        phone: "",
        message: "I’m having a hard moment and would appreciate a check-in when you can.",
        cancellationSeconds: 15,
      },
    },
  },
  people: [],
  moodEvents: [],
  chats: [],
  preferences: {
    launchConditions: {
      lateNight: true,
      allCaps: true,
      rapidRedrafting: true,
      alcoholWindow: false,
      specificPeople: false,
      alcoholHours: "9 PM – 2 AM",
    },
  },
});

export async function loadHoldOffStore(): Promise<HoldOffStore> {
  const raw = await AsyncStorage.getItem(HOLD_OFF_STORAGE_KEY);
  if (!raw) return createEmptyStore();
  try {
    const parsed = JSON.parse(raw) as Partial<HoldOffStore>;
    if (parsed.version !== 1) return createEmptyStore();
    return {
      ...createEmptyStore(),
      ...parsed,
      onboarding: { ...createEmptyStore().onboarding, ...parsed.onboarding },
      preferences: {
        launchConditions: {
          ...createEmptyStore().preferences.launchConditions,
          ...parsed.preferences?.launchConditions,
        },
      },
      drafts: parsed.drafts ?? [],
      interpretations: parsed.interpretations ?? [],
      importedThreads: parsed.importedThreads ?? [],
      smsClient: {
        ...createEmptyStore().smsClient,
        ...parsed.smsClient,
        conversations: parsed.smsClient?.conversations ?? [],
        messages: parsed.smsClient?.messages ?? [],
        heldMessages: parsed.smsClient?.heldMessages ?? [],
        spiralLock: {
          ...createEmptyStore().smsClient.spiralLock,
          ...parsed.smsClient?.spiralLock,
          trustedContactSupport: {
            ...createEmptyStore().smsClient.spiralLock.trustedContactSupport,
            ...parsed.smsClient?.spiralLock?.trustedContactSupport,
          },
        },
      },
      people: parsed.people ?? [],
      moodEvents: parsed.moodEvents ?? [],
      chats: parsed.chats ?? [],
    };
  } catch {
    return createEmptyStore();
  }
}

export async function persistHoldOffStore(store: HoldOffStore): Promise<void> {
  await AsyncStorage.setItem(HOLD_OFF_STORAGE_KEY, JSON.stringify(store));
}

export async function clearHoldOffStore(): Promise<void> {
  await AsyncStorage.removeItem(HOLD_OFF_STORAGE_KEY);
}
