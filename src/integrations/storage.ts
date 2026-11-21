// localStorage is per device. Failures (private mode, quota, disabled storage) are logged
// and the app keeps working in memory.
import type { Cells } from '../logic/cells.ts';

const KEY = 'kaiten-sushi-calc:cells:v1';

export function loadCells(): Cells {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Cells) : {};
  } catch (err) {
    console.warn('Could not read saved bill:', err);
    return {};
  }
}

export function saveCells(cells: Cells): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(cells));
    return true;
  } catch (err) {
    console.warn('Could not save bill:', err);
    return false;
  }
}
