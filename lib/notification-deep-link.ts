export function buildConversationDeepLink(scheme: string, address: string): string {
  return `${scheme}:///conversation/${encodeURIComponent(address)}`;
}

export function getConversationAddressFromDeepLink(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/conversation\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}
