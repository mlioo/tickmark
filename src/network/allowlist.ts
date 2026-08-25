const allowedHosts = new Set(["api.github.com", "raw.githubusercontent.com"]);

/** Reject any runtime fetch target outside the OpenTopo GitHub allowlist. */
export function assertAllowedUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    throw new Error(`Blocked non-OpenTopo network request to ${url.hostname}.`);
  }
  return url;
}
