export type DraftStatus = "HELD" | "READY_TO_SEND" | "SENT" | "DISCARDED" | "SAVED";
export type Verdict = "CLEAR" | "HOLD" | "SPIRAL_LOCK";
export type SadieExpression = "calm" | "listening" | "concerned" | "encouraging" | "celebrating";
export type RewriteTone = "balanced" | "empathetic" | "direct";

export interface WritingCues {
  allCapsWords: number;
  repeatedPunctuation: boolean;
  typingBurstSeconds: number;
  recentSameRecipientDrafts: number;
}

export interface SadieAnalysis {
  verdict: Verdict;
  explanation: string;
  gentleRewrite: string;
  signals: string[];
  moodScore: number;
  immediateCare: boolean;
  expression: SadieExpression;
}

export interface EmotionalSpiralCue {
  code: "all_caps" | "repeated_punctuation" | "absolute_language" | "urgent_language" | "rapid_typing";
  label: string;
  detail: string;
}

export interface ConversationHistoryAnalysis {
  summary: string;
  patterns: string[];
  momentsToNotice: string[];
  nextStep: string;
  immediateCare: boolean;
}

export interface Draft {
  id: string;
  recipient: string;
  phone?: string;
  body: string;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  cues: WritingCues;
  analysis?: SadieAnalysis;
  analysisError?: boolean;
}

export interface Interpretation {
  id: string;
  body: string;
  personId?: string;
  createdAt: string;
  tone: string;
  possibleMeaning: string;
  possibleFeeling: string;
  replyApproaches: string[];
}

export interface ImportedThread {
  id: string;
  personId: string;
  content: string;
  importedAt: string;
  source: "user_pasted_selected_sms";
}

export type DefaultSmsRoleStatus = "not_requested" | "native_build_required" | "role_requested" | "active" | "not_available";
export type SmsPermissionStatus = "not_requested" | "requested" | "granted" | "denied";

export interface SmsMessageRecord {
  id: string;
  conversationId: string;
  body: string;
  direction: "inbound" | "outbound";
  status: "queued" | "sent" | "delivered" | "failed" | "received";
  createdAt: string;
}

export interface SmsConversationRecord {
  id: string;
  address: string;
  personId?: string;
  displayName?: string;
  updatedAt: string;
  unreadCount: number;
  source: "default_sms_client";
}

export type SpiralLockReason = "user_hold" | "configured_cues";
export type TrustedContactSupportStatus = "not_configured" | "pending" | "cancelled" | "queued" | "failed";

export interface TrustedContactSupportSettings {
  enabled: boolean;
  acknowledged: boolean;
  contactName: string;
  phone: string;
  message: string;
  cancellationSeconds: number;
}

export interface SpiralLockSettings {
  enabled: boolean;
  emotionalCueCheckEnabled: boolean;
  triggerAllCaps: boolean;
  triggerRepeatedPunctuation: boolean;
  triggerRapidTyping: boolean;
  trustedContactSupport: TrustedContactSupportSettings;
}

export interface HeldSmsRecord {
  id: string;
  conversationId: string;
  address: string;
  body: string;
  reason: SpiralLockReason;
  createdAt: string;
  supportStatus: TrustedContactSupportStatus;
  supportMessageId?: string;
}

export interface SmsClientFoundationState {
  roleStatus: DefaultSmsRoleStatus;
  permissionStatus: SmsPermissionStatus;
  activationAcknowledged: boolean;
  privacyPolicyAcknowledged: boolean;
  lastRoleCheckAt?: string;
  conversations: SmsConversationRecord[];
  messages: SmsMessageRecord[];
  heldMessages: HeldSmsRecord[];
  spiralLock: SpiralLockSettings;
}

export interface Person {
  id: string;
  name: string;
  relationship: string;
  createdAt: string;
  isHarmful: boolean;
}

export interface MoodEvent {
  id: string;
  createdAt: string;
  score: number;
  personId?: string;
  source: "draft" | "chat";
}

export interface TrustedContact {
  name: string;
  method: string;
}

export interface OnboardingState {
  completed: boolean;
  step: number;
  ageConfirmed: boolean;
  capabilityAcknowledged: boolean;
  supportAcknowledged: boolean;
  analysisConsent: boolean;
  moodLearningConsent: boolean;
  trustedContact?: TrustedContact;
}

export interface LaunchConditions {
  lateNight: boolean;
  allCaps: boolean;
  rapidRedrafting: boolean;
  alcoholWindow: boolean;
  specificPeople: boolean;
  alcoholHours: string;
}

export interface AppPreferences {
  launchConditions: LaunchConditions;
}

export interface ChatMessage {
  id: string;
  role: "user" | "sadie";
  text: string;
  createdAt: string;
}

export interface HoldOffStore {
  version: 1;
  onboarding: OnboardingState;
  drafts: Draft[];
  interpretations: Interpretation[];
  importedThreads: ImportedThread[];
  smsClient: SmsClientFoundationState;
  people: Person[];
  moodEvents: MoodEvent[];
  chats: ChatMessage[];
  preferences: AppPreferences;
}

export interface SadieDraftRequest {
  draft: string;
  recipient: string;
  cues: WritingCues;
  rewriteTone?: RewriteTone;
}

export interface SadieInterpretRequest {
  message: string;
  avoidContact: boolean;
}

export interface SadieChatRequest {
  message: string;
  context: Array<Pick<ChatMessage, "role" | "text">>;
  sessionNote: string;
}

export interface SadieConversationHistoryRequest {
  participantLabel: string;
  messages: Array<Pick<SmsMessageRecord, "body" | "direction" | "createdAt">>;
}
