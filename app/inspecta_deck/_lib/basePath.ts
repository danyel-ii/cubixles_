const DEFAULT_BASE_PATH = "/inspecta_deck";
const RAW_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? DEFAULT_BASE_PATH;
const BASE_PATH =
  RAW_BASE_PATH && RAW_BASE_PATH !== "/"
    ? RAW_BASE_PATH.replace(/\/$/, "")
    : DEFAULT_BASE_PATH;

export function withBasePath(path: string) {
  if (!BASE_PATH) {
    return path;
  }
  if (path.startsWith(BASE_PATH)) {
    return path;
  }
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getBasePath() {
  return BASE_PATH;
}
