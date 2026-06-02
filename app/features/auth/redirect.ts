export const DEFAULT_AUTH_REDIRECT_PATH = "/";

export function resolveNextPath(next: string | null | undefined) {
  if (!next?.startsWith("/")) return DEFAULT_AUTH_REDIRECT_PATH;
  if (next.startsWith("//")) return DEFAULT_AUTH_REDIRECT_PATH;
  if (isAbsoluteUrl(next)) return DEFAULT_AUTH_REDIRECT_PATH;
  return next;
}

export function resolveOptionalNextPath(next: string | null | undefined) {
  const nextPath = resolveNextPath(next);
  return nextPath === DEFAULT_AUTH_REDIRECT_PATH && next !== DEFAULT_AUTH_REDIRECT_PATH ? null : nextPath;
}

function isAbsoluteUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
