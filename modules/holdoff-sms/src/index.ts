import { requireNativeModule } from "expo-modules-core";

export type NativeSmsEvent = {
  id: string;
  kind: "inbound" | "sent" | "delivered" | "failed";
  address: string;
  body: string;
  timestamp: string;
  status: "queued" | "sent" | "delivered" | "failed" | "received";
  errorCode?: string;
};

export type HoldOffSmsNativeModule = {
  getRoleState(): { available: boolean; active: boolean; packageName: string };
  requestDefaultSmsRole(): void;
  getMessagingPermissionState(): { roleActive: boolean; allGranted: boolean; missing: string[] };
  requestMessagingPermissions(): { requested: boolean; missing: string[] };
  sendText(address: string, body: string): { id: string; status: "queued" };
  getDeviceSmsHistory(): NativeSmsEvent[];
  getPendingEvents(): NativeSmsEvent[];
  acknowledgeEvents(ids: string[]): void;
  markConversationRead(address: string): void;
};

export default requireNativeModule<HoldOffSmsNativeModule>("HoldOffSms");
