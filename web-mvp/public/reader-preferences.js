export const READER_PREFERENCES_STORAGE_KEY = "saccade-reader-preferences-v1";

export const DEFAULT_READER_PREFERENCES = Object.freeze({
  highlightStyle: "marker",
  highlightTone: "amber",
  fontSize: 20,
  lineHeight: 1.85,
  measure: 70
});

const HIGHLIGHT_STYLES = new Set(["marker", "underline", "bold"]);
const HIGHLIGHT_TONES = new Set(["amber", "blue", "rose"]);

function clampNumber(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function normalizeReaderPreferences(value = {}) {
  return {
    highlightStyle: HIGHLIGHT_STYLES.has(value.highlightStyle)
      ? value.highlightStyle
      : DEFAULT_READER_PREFERENCES.highlightStyle,
    highlightTone: HIGHLIGHT_TONES.has(value.highlightTone)
      ? value.highlightTone
      : DEFAULT_READER_PREFERENCES.highlightTone,
    fontSize: clampNumber(value.fontSize, 16, 24, DEFAULT_READER_PREFERENCES.fontSize),
    lineHeight: clampNumber(value.lineHeight, 1.55, 2.1, DEFAULT_READER_PREFERENCES.lineHeight),
    measure: clampNumber(value.measure, 48, 78, DEFAULT_READER_PREFERENCES.measure)
  };
}

export function loadReaderPreferences(storage = localStorage) {
  try {
    return normalizeReaderPreferences(JSON.parse(storage.getItem(READER_PREFERENCES_STORAGE_KEY) || "{}"));
  } catch {
    return normalizeReaderPreferences();
  }
}

export function saveReaderPreferences(storage = localStorage, value = {}) {
  const normalized = normalizeReaderPreferences(value);
  try {
    storage.setItem(READER_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Preferences still apply for this session when storage is unavailable.
  }
  return normalized;
}

export function applyReaderPreferences(reader, preferences) {
  const normalized = normalizeReaderPreferences(preferences);
  reader.dataset.highlightStyle = normalized.highlightStyle;
  reader.dataset.highlightTone = normalized.highlightTone;
  reader.style.setProperty("--reader-font-size", `${normalized.fontSize}px`);
  reader.style.setProperty("--reader-line-height", String(normalized.lineHeight));
  reader.style.setProperty("--reader-measure", `${normalized.measure}ch`);
  return normalized;
}
