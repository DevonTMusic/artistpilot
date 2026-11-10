export const LEARN_MANUAL_KEY = "artistpilot-learn-progress";
export const LEARN_AUTO_KEY = "artistpilot-learn-auto";

export function readIds(key: string): string[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function markLearnDetected(id: string) {
  const current = readIds(LEARN_AUTO_KEY);
  if (current.includes(id)) return;
  try {
    window.localStorage.setItem(LEARN_AUTO_KEY, JSON.stringify([...current, id]));
  } catch (error) {
    console.warn("Could not save lesson progress:", error);
  }
}
