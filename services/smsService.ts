import { Platform } from "react-native";

export type SmsHandoffOutcome = "sent" | "opened" | "cancelled" | "unavailable" | "error";

/**
 * Opens the operating system SMS composer. HoldOff never sends SMS in the
 * background and never reads contacts; the person chooses any recipient and
 * confirms the send in their own messaging application.
 */
export async function openSmsComposer(phone: string | undefined, message: string): Promise<SmsHandoffOutcome> {
  if (Platform.OS === "web") return "unavailable";
  try {
    const SMS = await import("expo-sms");
    const available = await SMS.isAvailableAsync();
    if (!available) return "unavailable";
    const { result } = await SMS.sendSMSAsync(phone?.trim() ? [phone.trim()] : [], message);
    if (Platform.OS === "android") return "opened";
    if (result === "sent") return "sent";
    if (result === "cancelled") return "cancelled";
    return "opened";
  } catch {
    return "error";
  }
}
