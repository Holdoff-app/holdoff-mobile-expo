import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { createEmptyStore, clearHoldOffStore, loadHoldOffStore, persistHoldOffStore } from "@/lib/holdoff-storage";
import { markSmsConversationRead as markSmsConversationReadState, mergeNativeSmsEvents, normalizeSmsAddress } from "@/lib/sms-event-sync";
import type {
  ChatMessage,
  ConversationHistoryAnalysis,
  Draft,
  DraftStatus,
  HoldOffStore,
  Interpretation,
  ImportedThread,
  MoodEvent,
  OnboardingState,
  Person,
  SadieAnalysis,
  SadieConversationHistoryRequest,
  RewriteTone,
  SpiralLockSettings,
  SmsClientFoundationState,
  TrustedContact,
  WritingCues,
} from "@/lib/holdoff-types";
import { createId } from "@/lib/holdoff-utils";
import { sadieService, type SadieTransport } from "@/services/sadieService";
import { nativeSmsClient } from "@/services/native-sms-client";
import { resolveLocalContactNames, type ContactResolutionResult } from "@/services/contact-name-resolver";
import { trpc } from "@/lib/trpc";

type HoldOffContextValue = {
  store: HoldOffStore;
  ready: boolean;
  activeDraftId?: string;
  setActiveDraftId: (id?: string) => void;
  updateOnboarding: (patch: Partial<OnboardingState>) => void;
  completeOnboarding: () => void;
  createOrUpdateDraft: (input: { id?: string; recipient: string; phone?: string; body: string; cues: WritingCues }) => Draft;
  analyzeDraft: (draft: Draft) => Promise<SadieAnalysis | null>;
  analyzeCurrentMessage: (input: { body: string; recipient: string; cues: WritingCues; rewriteTone?: RewriteTone }) => Promise<SadieAnalysis | null>;
  analyzeConversationHistory: (request: SadieConversationHistoryRequest) => Promise<ConversationHistoryAnalysis | null>;
  setDraftStatus: (id: string, status: DraftStatus) => void;
  interpretMessage: (input: { body: string; personId?: string }) => Promise<Interpretation | null>;
  importSelectedSmsThread: (input: { personId: string; content: string }) => ImportedThread | null;
  addPerson: (name: string, relationship: string) => Person | null;
  updatePerson: (id: string, patch: Partial<Pick<Person, "name" | "relationship" | "isHarmful">>) => void;
  updatePreferences: (patch: Partial<HoldOffStore["preferences"]["launchConditions"]>) => void;
  updateSmsClientFoundation: (patch: Partial<Pick<SmsClientFoundationState, "roleStatus" | "permissionStatus" | "activationAcknowledged" | "privacyPolicyAcknowledged" | "lastRoleCheckAt">>) => void;
  syncNativeSmsEvents: () => Promise<number>;
  syncDeviceSmsHistory: () => Promise<number>;
  resolveConversationContactNames: () => Promise<{ status: ContactResolutionResult["status"]; resolvedCount: number }>;
  clearConversationContactNames: () => void;
  markSmsConversationRead: (input: { conversationId: string; address: string }) => Promise<void>;
  updateSpiralLock: (patch: Partial<SpiralLockSettings>) => void;
  holdOutgoingMessage: (input: { address: string; body: string; reason: "user_hold" | "configured_cues" }) => string | null;
  removeHeldMessage: (id: string) => void;
  updateHeldMessageSupport: (id: string, patch: { supportStatus: "pending" | "cancelled" | "queued" | "failed"; supportMessageId?: string }) => void;
  sendNativeSms: (input: { address: string; body: string }) => Promise<{ id: string } | null>;
  setTrustedContact: (contact?: TrustedContact) => void;
  sendChat: (message: string, options?: { source?: "thread" }) => Promise<void>;
  exportJson: () => string;
  deleteEverything: () => Promise<void>;
};

const HoldOffContext = createContext<HoldOffContextValue | null>(null);

export function HoldOffProvider({ children }: PropsWithChildren) {
  const [store, setStore] = useState<HoldOffStore>(createEmptyStore);
  const storeRef = useRef(store);
  const [ready, setReady] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string>();
  const analyzeMutation = trpc.sadie.analyze.useMutation();
  const conversationHistoryMutation = trpc.sadie.analyzeConversationHistory.useMutation();
  const interpretMutation = trpc.sadie.interpret.useMutation();
  const chatMutation = trpc.sadie.chat.useMutation();

  useEffect(() => {
    loadHoldOffStore()
      .then((loaded) => {
        storeRef.current = loaded;
        setStore(loaded);
      })
      .finally(() => setReady(true));
  }, []);

  const updateStore = useCallback((updater: (previous: HoldOffStore) => HoldOffStore) => {
    setStore((previous) => {
      const next = updater(previous);
      storeRef.current = next;
      void persistHoldOffStore(next);
      return next;
    });
  }, []);

  const transport = useMemo<SadieTransport>(
    () => ({
      analyzeDraft: analyzeMutation.mutateAsync,
      analyzeConversationHistory: conversationHistoryMutation.mutateAsync,
      interpretMessage: interpretMutation.mutateAsync,
      chat: chatMutation.mutateAsync,
    }),
    [analyzeMutation.mutateAsync, chatMutation.mutateAsync, conversationHistoryMutation.mutateAsync, interpretMutation.mutateAsync],
  );

  const updateOnboarding = useCallback((patch: Partial<OnboardingState>) => {
    updateStore((previous) => ({ ...previous, onboarding: { ...previous.onboarding, ...patch } }));
  }, [updateStore]);

  const completeOnboarding = useCallback(() => {
    updateStore((previous) => ({ ...previous, onboarding: { ...previous.onboarding, completed: true, step: 6 } }));
  }, [updateStore]);

  const createOrUpdateDraft = useCallback((input: { id?: string; recipient: string; phone?: string; body: string; cues: WritingCues }) => {
    const now = new Date().toISOString();
    const draft: Draft = {
      id: input.id ?? createId("draft"),
      recipient: input.recipient.trim(),
      phone: input.phone?.trim() || undefined,
      body: input.body.trim(),
      status: "HELD",
      createdAt: now,
      updatedAt: now,
      cues: input.cues,
    };
    updateStore((previous) => {
      const existing = previous.drafts.find((item) => item.id === draft.id);
      const saved = existing
        ? { ...existing, ...draft, createdAt: existing.createdAt, analysis: undefined, analysisError: false }
        : draft;
      return {
        ...previous,
        drafts: existing ? previous.drafts.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...previous.drafts],
      };
    });
    setActiveDraftId(draft.id);
    return draft;
  }, [updateStore]);

  const analyzeDraft = useCallback(async (draft: Draft): Promise<SadieAnalysis | null> => {
    if (!store.onboarding.analysisConsent) return null;
    try {
      const analysis = await sadieService.analyzeDraft(transport, {
        draft: draft.body,
        recipient: draft.recipient,
        cues: draft.cues,
      });
      updateStore((previous) => {
        const personId = previous.people.find((person) => person.name.toLowerCase() === draft.recipient.toLowerCase())?.id;
        const mood: MoodEvent[] = previous.onboarding.moodLearningConsent
          ? [
              {
                id: createId("mood"),
                createdAt: new Date().toISOString(),
                score: analysis.moodScore,
                personId,
                source: "draft",
              },
              ...previous.moodEvents,
            ]
          : previous.moodEvents;
        return {
          ...previous,
          drafts: previous.drafts.map((item) =>
            item.id === draft.id
              ? {
                  ...item,
                  analysis,
                  analysisError: false,
                  status: analysis.verdict === "CLEAR" ? "READY_TO_SEND" : "HELD",
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
          moodEvents: mood,
        };
      });
      return analysis;
    } catch {
      updateStore((previous) => ({
        ...previous,
        drafts: previous.drafts.map((item) =>
          item.id === draft.id ? { ...item, analysisError: true, updatedAt: new Date().toISOString() } : item,
        ),
      }));
      return null;
    }
  }, [store.onboarding.analysisConsent, transport, updateStore]);

  const analyzeCurrentMessage = useCallback(async (input: { body: string; recipient: string; cues: WritingCues; rewriteTone?: RewriteTone }): Promise<SadieAnalysis | null> => {
    if (!store.onboarding.analysisConsent || !input.body.trim()) return null;
    try {
      return await sadieService.analyzeDraft(transport, {
        draft: input.body.trim(),
        recipient: input.recipient.trim().slice(0, 100),
        cues: input.cues,
        rewriteTone: input.rewriteTone ?? "balanced",
      });
    } catch {
      return null;
    }
  }, [store.onboarding.analysisConsent, transport]);

  const analyzeConversationHistory = useCallback(async (request: SadieConversationHistoryRequest): Promise<ConversationHistoryAnalysis | null> => {
    if (!store.onboarding.analysisConsent || !request.messages.length) return null;
    try {
      return await sadieService.analyzeConversationHistory(transport, request);
    } catch {
      return null;
    }
  }, [store.onboarding.analysisConsent, transport]);

  const setDraftStatus = useCallback((id: string, status: DraftStatus) => {
    updateStore((previous) => ({
      ...previous,
      drafts: previous.drafts.map((draft) =>
        draft.id === id ? { ...draft, status, updatedAt: new Date().toISOString() } : draft,
      ),
    }));
  }, [updateStore]);

  const interpretMessage = useCallback(async (input: { body: string; personId?: string }): Promise<Interpretation | null> => {
    if (!store.onboarding.analysisConsent) return null;
    const relatedPerson = store.people.find((person) => person.id === input.personId);
    try {
      const answer = await sadieService.interpretMessage(transport, {
        message: input.body.trim(),
        avoidContact: Boolean(relatedPerson?.isHarmful),
      });
      const interpretation: Interpretation = {
        id: createId("interpret"),
        body: input.body.trim(),
        personId: input.personId,
        createdAt: new Date().toISOString(),
        ...answer,
      };
      updateStore((previous) => ({ ...previous, interpretations: [interpretation, ...previous.interpretations] }));
      return interpretation;
    } catch {
      return null;
    }
  }, [store.onboarding.analysisConsent, store.people, transport, updateStore]);

  const importSelectedSmsThread = useCallback((input: { personId: string; content: string }): ImportedThread | null => {
    const content = input.content.trim();
    if (!content || !store.people.some((person) => person.id === input.personId)) return null;
    const importedThread: ImportedThread = {
      id: createId("sms-thread"),
      personId: input.personId,
      content: content.slice(0, 16000),
      importedAt: new Date().toISOString(),
      source: "user_pasted_selected_sms",
    };
    updateStore((previous) => ({ ...previous, importedThreads: [importedThread, ...previous.importedThreads] }));
    return importedThread;
  }, [store.people, updateStore]);

  const addPerson = useCallback((name: string, relationship: string): Person | null => {
    const cleanName = name.trim();
    if (!cleanName) return null;
    const existing = store.people.find((person) => person.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) return existing;
    const person: Person = {
      id: createId("person"),
      name: cleanName,
      relationship: relationship.trim() || "Someone you care about",
      createdAt: new Date().toISOString(),
      isHarmful: false,
    };
    updateStore((previous) => ({ ...previous, people: [person, ...previous.people] }));
    return person;
  }, [store.people, updateStore]);

  const updatePerson = useCallback((id: string, patch: Partial<Pick<Person, "name" | "relationship" | "isHarmful">>) => {
    updateStore((previous) => ({
      ...previous,
      people: previous.people.map((person) => (person.id === id ? { ...person, ...patch } : person)),
    }));
  }, [updateStore]);

  const updatePreferences = useCallback((patch: Partial<HoldOffStore["preferences"]["launchConditions"]>) => {
    updateStore((previous) => ({
      ...previous,
      preferences: { launchConditions: { ...previous.preferences.launchConditions, ...patch } },
    }));
  }, [updateStore]);

  const updateSmsClientFoundation = useCallback((patch: Partial<Pick<SmsClientFoundationState, "roleStatus" | "permissionStatus" | "activationAcknowledged" | "privacyPolicyAcknowledged" | "lastRoleCheckAt">>) => {
    updateStore((previous) => ({ ...previous, smsClient: { ...previous.smsClient, ...patch } }));
  }, [updateStore]);

  const syncNativeSmsEvents = useCallback(async (): Promise<number> => {
    const initialClient = storeRef.current.smsClient;
    if (initialClient.roleStatus !== "active" || initialClient.permissionStatus !== "granted") return 0;

    try {
      const events = await nativeSmsClient.getPendingEvents();
      if (!events.length) return 0;

      const commit = await new Promise<{ next: HoldOffStore; persistedEventIds: string[] }>((resolve) => {
        setStore((previous) => {
          const merged = mergeNativeSmsEvents(previous.smsClient, events);
          const next = { ...previous, smsClient: merged.smsClient };
          storeRef.current = next;
          resolve({ next, persistedEventIds: merged.persistedEventIds });
          return next;
        });
      });

      if (!commit.persistedEventIds.length) return 0;
      await persistHoldOffStore(commit.next);
      await nativeSmsClient.acknowledge(commit.persistedEventIds);
      return commit.persistedEventIds.length;
    } catch {
      return 0;
    }
  }, []);

  const syncDeviceSmsHistory = useCallback(async (): Promise<number> => {
    const client = storeRef.current.smsClient;
    if (client.roleStatus !== "active" || client.permissionStatus !== "granted") return 0;
    try {
      const events = await nativeSmsClient.getDeviceSmsHistory();
      if (!events.length) return 0;
      const next = await new Promise<HoldOffStore>((resolve) => {
        setStore((previous) => {
          const updated = { ...previous, smsClient: mergeNativeSmsEvents(previous.smsClient, events).smsClient };
          storeRef.current = updated;
          resolve(updated);
          return updated;
        });
      });
      await persistHoldOffStore(next);
      return events.length;
    } catch {
      return 0;
    }
  }, []);

  const resolveConversationContactNames = useCallback(async (): Promise<{ status: ContactResolutionResult["status"]; resolvedCount: number }> => {
    const addresses = storeRef.current.smsClient.conversations.map((conversation) => conversation.address);
    const result = await resolveLocalContactNames(addresses);
    if (result.status !== "granted") return { status: result.status, resolvedCount: 0 };
    const namesByAddress = result.namesByAddress;
    const resolvedCount = Object.keys(namesByAddress).length;
    updateStore((previous) => ({
      ...previous,
      smsClient: {
        ...previous.smsClient,
        conversations: previous.smsClient.conversations.map((conversation) => ({
          ...conversation,
          displayName: namesByAddress[normalizeSmsAddress(conversation.address)],
        })),
      },
    }));
    return { status: "granted", resolvedCount };
  }, [updateStore]);

  const clearConversationContactNames = useCallback(() => {
    updateStore((previous) => ({
      ...previous,
      smsClient: {
        ...previous.smsClient,
        conversations: previous.smsClient.conversations.map((conversation) => ({ ...conversation, displayName: undefined })),
      },
    }));
  }, [updateStore]);

  const markSmsConversationRead = useCallback(async ({ conversationId, address }: { conversationId: string; address: string }): Promise<void> => {
    if (!conversationId || !address.trim()) return;
    updateStore((previous) => ({
      ...previous,
      smsClient: markSmsConversationReadState(previous.smsClient, conversationId),
    }));
    const client = storeRef.current.smsClient;
    if (client.roleStatus !== "active" || client.permissionStatus !== "granted") return;
    try {
      await nativeSmsClient.markConversationRead(address);
    } catch {
      // Local read state remains correct when optional native notification cleanup is unavailable.
    }
  }, [updateStore]);

  const updateSpiralLock = useCallback((patch: Partial<SpiralLockSettings>) => {
    updateStore((previous) => ({
      ...previous,
      smsClient: {
        ...previous.smsClient,
        spiralLock: { ...previous.smsClient.spiralLock, ...patch },
      },
    }));
  }, [updateStore]);

  const holdOutgoingMessage = useCallback((input: { address: string; body: string; reason: "user_hold" | "configured_cues" }): string | null => {
    const address = input.address.trim();
    const body = input.body.trim();
    if (!address || !body) return null;

    const conversationId = `sms-conversation:${normalizeSmsAddress(address)}`;
    const heldId = createId("held-sms");
    const createdAt = new Date().toISOString();
    updateStore((previous) => {
      const exists = previous.smsClient.conversations.some((conversation) => conversation.id === conversationId);
      const conversations = exists
        ? previous.smsClient.conversations.map((conversation) => (conversation.id === conversationId ? { ...conversation, updatedAt: createdAt } : conversation))
        : [{ id: conversationId, address, updatedAt: createdAt, unreadCount: 0, source: "default_sms_client" as const }, ...previous.smsClient.conversations];
      return {
        ...previous,
        smsClient: {
          ...previous.smsClient,
          conversations,
          heldMessages: [{
            id: heldId,
            conversationId,
            address,
            body,
            reason: input.reason,
            createdAt,
            supportStatus: "not_configured",
          }, ...previous.smsClient.heldMessages],
        },
      };
    });
    return heldId;
  }, [updateStore]);

  const removeHeldMessage = useCallback((id: string) => {
    updateStore((previous) => ({
      ...previous,
      smsClient: {
        ...previous.smsClient,
        heldMessages: previous.smsClient.heldMessages.filter((message) => message.id !== id),
      },
    }));
  }, [updateStore]);

  const updateHeldMessageSupport = useCallback((id: string, patch: { supportStatus: "pending" | "cancelled" | "queued" | "failed"; supportMessageId?: string }) => {
    updateStore((previous) => ({
      ...previous,
      smsClient: {
        ...previous.smsClient,
        heldMessages: previous.smsClient.heldMessages.map((message) => (message.id === id ? { ...message, ...patch } : message)),
      },
    }));
  }, [updateStore]);

  const sendNativeSms = useCallback(async (input: { address: string; body: string }): Promise<{ id: string } | null> => {
    const address = input.address.trim();
    const body = input.body.trim();
    const client = storeRef.current.smsClient;
    if (!address || !body || client.roleStatus !== "active" || client.permissionStatus !== "granted") return null;
    try {
      const result = await nativeSmsClient.sendText(address, body);
      if (!result) return null;
      updateStore((previous) => ({
        ...previous,
        smsClient: mergeNativeSmsEvents(previous.smsClient, [{
          id: result.id,
          kind: "sent",
          address,
          body,
          timestamp: Date.now().toString(),
          status: "queued",
        }]).smsClient,
      }));
      void syncNativeSmsEvents();
      return { id: result.id };
    } catch {
      return null;
    }
  }, [syncNativeSmsEvents, updateStore]);

  const setTrustedContact = useCallback((contact?: TrustedContact) => {
    updateStore((previous) => ({ ...previous, onboarding: { ...previous.onboarding, trustedContact: contact } }));
  }, [updateStore]);

  const sendChat = useCallback(async (message: string, options?: { source?: "thread" }) => {
    const text = message.trim();
    if (!text || !store.onboarding.analysisConsent) return;
    const userMessage: ChatMessage = { id: createId("chat"), role: "user", text, createdAt: new Date().toISOString() };
    updateStore((previous) => ({ ...previous, chats: [...previous.chats, userMessage] }));
    try {
      const response = await sadieService.chat(transport, {
        message: text,
        context: store.chats.slice(-6).map(({ role, text: messageText }) => ({ role, text: messageText })),
        sessionNote: [
          options?.source === "thread" ? "The user explicitly opened Sadie from an active message thread. No thread text has been provided; do not assume its content." : "",
          store.drafts.slice(0, 3).map((draft) => `Recent draft to ${draft.recipient || "someone"}: ${draft.analysis?.verdict ?? draft.status}.`).join(" "),
          store.moodEvents.slice(0, 3).length ? `Recent inferred writing activation scores: ${store.moodEvents.slice(0, 3).map((event) => event.score).join(", ")}.` : "No recent writing-pattern score is available.",
        ].join(" ").slice(0, 600),
      });
      const reply: ChatMessage = { id: createId("sadie"), role: "sadie", text: response.reply, createdAt: new Date().toISOString() };
      updateStore((previous) => ({
        ...previous,
        chats: [...previous.chats, reply],
        moodEvents: previous.onboarding.moodLearningConsent
          ? [{ id: createId("mood"), createdAt: reply.createdAt, score: response.moodScore, source: "chat" }, ...previous.moodEvents]
          : previous.moodEvents,
      }));
    } catch {
      const reply: ChatMessage = {
        id: createId("sadie"),
        role: "sadie",
        text: "Sadie can't reach her thoughts right now — your draft is safe and everything still works manually.",
        createdAt: new Date().toISOString(),
      };
      updateStore((previous) => ({ ...previous, chats: [...previous.chats, reply] }));
    }
  }, [store.chats, store.drafts, store.moodEvents, store.onboarding.analysisConsent, transport, updateStore]);

  const exportJson = useCallback(() => JSON.stringify(store, null, 2), [store]);

  const deleteEverything = useCallback(async () => {
    await clearHoldOffStore();
    const emptyStore = createEmptyStore();
    storeRef.current = emptyStore;
    setStore(emptyStore);
    setActiveDraftId(undefined);
  }, []);

  const value = useMemo<HoldOffContextValue>(() => ({
    store,
    ready,
    activeDraftId,
    setActiveDraftId,
    updateOnboarding,
    completeOnboarding,
    createOrUpdateDraft,
    analyzeDraft,
    analyzeCurrentMessage,
    analyzeConversationHistory,
    setDraftStatus,
    interpretMessage,
    importSelectedSmsThread,
    addPerson,
    updatePerson,
    updatePreferences,
    updateSmsClientFoundation,
    syncNativeSmsEvents,
    syncDeviceSmsHistory,
    resolveConversationContactNames,
    clearConversationContactNames,
    markSmsConversationRead,
    updateSpiralLock,
    holdOutgoingMessage,
    removeHeldMessage,
    updateHeldMessageSupport,
    sendNativeSms,
    setTrustedContact,
    sendChat,
    exportJson,
    deleteEverything,
  }), [activeDraftId, addPerson, analyzeConversationHistory, analyzeCurrentMessage, analyzeDraft, clearConversationContactNames, completeOnboarding, createOrUpdateDraft, deleteEverything, exportJson, holdOutgoingMessage, importSelectedSmsThread, interpretMessage, markSmsConversationRead, ready, removeHeldMessage, resolveConversationContactNames, sendChat, sendNativeSms, setDraftStatus, setTrustedContact, store, syncDeviceSmsHistory, syncNativeSmsEvents, updateHeldMessageSupport, updateOnboarding, updatePerson, updatePreferences, updateSmsClientFoundation, updateSpiralLock]);

  return <HoldOffContext.Provider value={value}>{children}</HoldOffContext.Provider>;
}

export function useHoldOff(): HoldOffContextValue {
  const context = useContext(HoldOffContext);
  if (!context) throw new Error("useHoldOff must be used inside HoldOffProvider");
  return context;
}
