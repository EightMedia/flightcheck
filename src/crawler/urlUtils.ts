export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeUrl(urlString: string): string {
  const url = new URL(urlString);
  url.hash = "";
  url.search = "";

  if (url.pathname === "") {
    url.pathname = "/";
  }

  return url.toString();
}

export function resolveUrlMaybe(value: string, baseUrl: string): string {
  if (!value) return "";
  try {
    return normalizeUrl(new URL(value, baseUrl).toString());
  } catch {
    return value;
  }
}

export function parseExcludePatterns(rawExcludes: string[]): string[] {
  if (rawExcludes.length === 0) return [];
  return rawExcludes.flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean);
}

export function matchesExcludePattern(urlString: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  const normalized = normalizeUrl(urlString);
  const pathname = new URL(normalized).pathname;
  return patterns.some((pattern) => normalized.includes(pattern) || pathname.includes(pattern));
}
