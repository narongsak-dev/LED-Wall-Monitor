/**
 * Copy text to clipboard with a fallback for non-secure-context pages.
 *
 * `navigator.clipboard.writeText` requires HTTPS (or localhost) — over a
 * plain HTTP LAN deployment (which is what 10.88.1.169:8081 currently is)
 * the API is undefined and throws. The textarea + `execCommand` trick is
 * the universally-supported fallback; it works on every browser since IE9.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the manual approach
    }
  }
  // Manual fallback: stage an offscreen textarea, select it, execCommand.
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
