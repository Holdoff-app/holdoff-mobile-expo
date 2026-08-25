import { Platform } from "react-native";

import { resolveContactNamesByAddress } from "@/lib/contact-resolution";

export type ContactResolutionResult = {
  status: "granted" | "denied" | "unavailable";
  namesByAddress: Record<string, string>;
};

type ContactsModule = typeof import("expo-contacts");

async function getContactsModule(): Promise<ContactsModule | null> {
  if (Platform.OS === "web") return null;
  try {
    return await import("expo-contacts");
  } catch {
    return null;
  }
}

export async function resolveLocalContactNames(addresses: string[]): Promise<ContactResolutionResult> {
  if (!addresses.length) return { status: "granted", namesByAddress: {} };
  const Contacts = await getContactsModule();
  if (!Contacts) return { status: "unavailable", namesByAddress: {} };
  try {
    let permission = await Contacts.getPermissionsAsync();
    if (!permission.granted) permission = await Contacts.requestPermissionsAsync();
    if (!permission.granted) return { status: "denied", namesByAddress: {} };
    const response = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
    return {
      status: "granted",
      namesByAddress: resolveContactNamesByAddress(addresses, response.data),
    };
  } catch {
    return { status: "unavailable", namesByAddress: {} };
  }
}
