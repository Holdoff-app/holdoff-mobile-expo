import type { NativeSmsEvent } from "holdoff-sms";

export type NativeSmsRoleState = { available: boolean; active: boolean; packageName: string };
export type NativeSmsPermissionState = { roleActive: boolean; allGranted: boolean; missing: string[] };
type NativeSmsModule = {
  getRoleState: () => NativeSmsRoleState;
  requestDefaultSmsRole: () => void;
  getMessagingPermissionState: () => NativeSmsPermissionState;
  requestMessagingPermissions: () => { requested: boolean; missing: string[] };
  sendText: (address: string, body: string) => { id: string; status: "queued" };
  getDeviceSmsHistory: () => NativeSmsEvent[];
  getPendingEvents: () => NativeSmsEvent[];
  acknowledgeEvents: (ids: string[]) => void;
  markConversationRead: (address: string) => void;
};

async function getModule(): Promise<NativeSmsModule | null> {
  try {
    const imported = await import("holdoff-sms");
    return imported.default as NativeSmsModule;
  } catch {
    return null;
  }
}

export const nativeSmsClient = {
  async getRoleState(): Promise<NativeSmsRoleState | null> {
    return (await getModule())?.getRoleState() ?? null;
  },
  async requestRole(): Promise<boolean> {
    const module = await getModule();
    if (!module) return false;
    module.requestDefaultSmsRole();
    return true;
  },
  async getMessagingPermissionState(): Promise<NativeSmsPermissionState | null> {
    return (await getModule())?.getMessagingPermissionState() ?? null;
  },
  async requestMessagingPermissions(): Promise<{ requested: boolean; missing: string[] } | null> {
    const module = await getModule();
    if (!module) return null;
    return module.requestMessagingPermissions();
  },
  async sendText(address: string, body: string): Promise<{ id: string; status: "queued" } | null> {
    const module = await getModule();
    if (!module) return null;
    return module.sendText(address, body);
  },
  async getDeviceSmsHistory(): Promise<NativeSmsEvent[]> {
    return (await getModule())?.getDeviceSmsHistory() ?? [];
  },
  async getPendingEvents(): Promise<NativeSmsEvent[]> {
    return (await getModule())?.getPendingEvents() ?? [];
  },
  async acknowledge(ids: string[]): Promise<void> {
    (await getModule())?.acknowledgeEvents(ids);
  },
  async markConversationRead(address: string): Promise<void> {
    if (!address.trim()) return;
    (await getModule())?.markConversationRead(address);
  },
};
