// localStorage is per device. Failures (private mode, quota, disabled storage) are logged
// and the app keeps working in memory.
const KEY = 'kaiten-sushi-calc:cells:v1';

export function loadCells() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    console.warn('Could not read saved bill:', err);
    return {};
  }
}

export function saveCells(cells) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cells));
    return true;
  } catch (err) {
    console.warn('Could not save bill:', err);
    return false;
  }
}
