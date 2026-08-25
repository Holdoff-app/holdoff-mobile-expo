import { normalizeSmsAddress } from "./sms-event-sync";

export type ContactPhoneMatch = { name?: string; phoneNumbers?: Array<{ number?: string; digits?: string }> };

function addressKeys(address: string): string[] {
  const normalized = normalizeSmsAddress(address);
  const digits = normalized.replace(/\D/g, "");
  const keys = [normalized, digits];
  if (digits.length >= 10) keys.push(digits.slice(-10));
  return [...new Set(keys.filter(Boolean))];
}

export function resolveContactNamesByAddress(
  addresses: string[],
  contacts: ContactPhoneMatch[],
): Record<string, string> {
  const nameByKey = new Map<string, string | null>();
  contacts.forEach((contact) => {
    const name = contact.name?.trim();
    if (!name) return;
    contact.phoneNumbers?.forEach((phone) => {
      const value = phone.number ?? phone.digits;
      if (!value) return;
      addressKeys(value).forEach((key) => {
        const current = nameByKey.get(key);
        nameByKey.set(key, current && current !== name ? null : name);
      });
    });
  });

  return Object.fromEntries(addresses.flatMap((address) => {
    const name = addressKeys(address).map((key) => nameByKey.get(key)).find((value): value is string => Boolean(value));
    return name ? [[normalizeSmsAddress(address), name]] : [];
  }));
}
