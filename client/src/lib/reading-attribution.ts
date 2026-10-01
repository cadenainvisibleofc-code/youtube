export function parseReadingAttribution(search?: string | null) {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(typeof search === "string" ? search : "");
  } catch {
    params = new URLSearchParams();
  }
  const safe = (value: string | null, fallback: string, maxLength: number) => {
    const normalized = (value ?? "").trim();
    return normalized ? normalized.slice(0, maxLength) : fallback;
  };
  return {
    source: safe(params.get("utm_source"), "direct", 80),
    campaign: safe(params.get("utm_campaign"), "none", 120),
    video: safe(params.get("video"), "unknown", 200),
  };
}
