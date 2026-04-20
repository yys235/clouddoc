export function normalizeServerLocalStorage() {
  if (typeof window !== "undefined") {
    return;
  }

  const globalWithStorage = globalThis as typeof globalThis & {
    localStorage?: { getItem?: unknown };
  };

  if (
    globalWithStorage.localStorage !== undefined &&
    typeof globalWithStorage.localStorage.getItem !== "function"
  ) {
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  }
}
