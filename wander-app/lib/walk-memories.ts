/**
 * One memory (photo) per walk, stored in IndexedDB.
 *
 * Photos are too large for localStorage (~5 MB total), so memories live in
 * IndexedDB. The `walkId` index is unique, so the store itself rejects a
 * second memory for the same walk — the UI check is a convenience, not the
 * only guard.
 */

export type WalkMemory = {
  id: string;
  walkId: string;
  createdAt: string;
  routeTitle: string;
  stopId?: string;
  stopName?: string;
  photo: Blob;
};

export type SaveMemoryResult =
  | { ok: true; memory: WalkMemory }
  | { ok: false; reason: "already-saved" | "unavailable" | "error"; message: string };

const DB_NAME = "wander-memories";
const STORE = "memories";
const RULE_SEEN_KEY = "wander:memory-rule-seen";
export const MEMORIES_CHANGED_EVENT = "wander:memories";

export const ALREADY_SAVED_MESSAGE = "This walk already has its memory. One memory per walk, so make it count.";

/** Unique id that also works on plain-http origins where crypto.randomUUID is unavailable. */
export function createId(prefix: string) {
  const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

function openDbAt(version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("walkId", "walkId", { unique: true });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Let a future upgrade (another tab, or the repair below) proceed.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Opens the database, creating the store if an earlier/empty database lacks it. */
async function openDb(): Promise<IDBDatabase> {
  const db = await openDbAt();
  if (db.objectStoreNames.contains(STORE)) return db;
  const nextVersion = db.version + 1;
  db.close();
  return openDbAt(nextVersion);
}

export async function getMemoryForWalk(walkId: string): Promise<WalkMemory | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      tx.oncomplete = () => db.close();
      const request = tx.objectStore(STORE).index("walkId").get(walkId);
      request.onsuccess = () => resolve((request.result as WalkMemory | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

/** Every walk memory on this device, newest first. */
export async function listWalkMemories(): Promise<WalkMemory[]> {
  try {
    const db = await openDb();
    const memories = await new Promise<WalkMemory[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      tx.oncomplete = () => db.close();
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as WalkMemory[]) ?? []);
      request.onerror = () => reject(request.error);
    });
    return memories.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

/** Saves the walk's one memory. Checks first, and the unique index rejects a race or repeat. */
export async function saveWalkMemory(input: Omit<WalkMemory, "id" | "createdAt">): Promise<SaveMemoryResult> {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return { ok: false, reason: "unavailable", message: "This browser can't store memories. Try a different browser or turn off private browsing." };
  }
  const memory: WalkMemory = { ...input, id: createId("memory"), createdAt: new Date().toISOString() };
  const failed: SaveMemoryResult = { ok: false, reason: "error", message: "Couldn't save your memory. Please try again." };
  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, "readwrite");
    } catch {
      db.close();
      resolve(failed);
      return;
    }
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
    const store = tx.objectStore(STORE);
    const existing = store.index("walkId").getKey(memory.walkId);
    existing.onsuccess = () => {
      if (existing.result !== undefined) {
        resolve({ ok: false, reason: "already-saved", message: ALREADY_SAVED_MESSAGE });
        return;
      }
      const add = store.add(memory);
      add.onsuccess = () => {
        resolve({ ok: true, memory });
        window.dispatchEvent(new Event(MEMORIES_CHANGED_EVENT));
      };
      add.onerror = (event) => {
        event.preventDefault();
        resolve(add.error?.name === "ConstraintError"
          ? { ok: false, reason: "already-saved", message: ALREADY_SAVED_MESSAGE }
          : failed);
      };
    };
    existing.onerror = () => resolve(failed);
  });
}

export function hasSeenMemoryRule() {
  try {
    return window.localStorage.getItem(RULE_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markMemoryRuleSeen() {
  try {
    window.localStorage.setItem(RULE_SEEN_KEY, "1");
  } catch {
    // Private mode: the explanation just shows again next time.
  }
}
