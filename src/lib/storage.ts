/**
 * Library for handling data persistence in Bakery OS using localStorage.
 */

export const STORAGE_KEYS = {
  NVL: "bakery_os_nvl",
  RECIPES: "bakery_os_recipes",
  LOGS: "bakery_os_logs",
  OVERHEAD: "bakery_os_overhead",
};

export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving to storage for key ${key}:`, error);
  }
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (error) {
    console.error(`Error loading from storage for key ${key}:`, error);
    return fallback;
  }
}
