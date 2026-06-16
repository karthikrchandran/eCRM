export function isSafeExternalUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
