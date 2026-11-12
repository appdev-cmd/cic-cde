import { projectHref } from "./projectRoute";

function key(username: string, projectId: string) {
  return "ciccde.recent-ifc:" + JSON.stringify([username, projectId]);
}

export function readRecentIfc(username: string, projectId: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key(username, projectId)) ?? "null");
    if (Number.isSafeInteger(value?.id) && value.id > 0 && typeof value.title === "string") {
      return { id: value.id as number, title: value.title as string };
    }
  } catch {
    // A recent item is optional.
  }
}

export function rememberIfc(username: string, projectId: string, id: number, title: string) {
  try {
    localStorage.setItem(key(username, projectId), JSON.stringify({ id, title }));
  } catch {
    // Browsing the register does not depend on local storage.
  }
}

export function forgetIfc(username: string, projectId: string, id: number) {
  try {
    if (readRecentIfc(username, projectId)?.id === id) localStorage.removeItem(key(username, projectId));
  } catch {
    // Browsing the register does not depend on local storage.
  }
}

export function recentIfcHref(projectId: string, version: number) {
  const query = new URLSearchParams(projectHref(projectId, "files"));
  query.set("file", "ifc");
  query.set("version", String(version));
  return "?" + query.toString();
}
