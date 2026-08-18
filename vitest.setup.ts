// Node 22+ ships an experimental global `localStorage` that throws unless
// launched with `--localstorage-file`, and it shadows jsdom's own
// window.localStorage in this Vitest/Node combination. Replace it with a
// plain in-memory Storage so code that touches localStorage (e.g. zustand's
// persist middleware) works the same as it does in a real browser.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

const memoryStorage = new MemoryStorage();

for (const target of [globalThis, window]) {
  Object.defineProperty(target, "localStorage", {
    value: memoryStorage,
    writable: true,
    configurable: true,
  });
}
