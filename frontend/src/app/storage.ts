/** Ask the browser not to evict our IndexedDB data (PRD §5.8). Returns whether storage is persistent. */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = navigator.storage;
  if (!storage?.persist || !storage.persisted) return false;
  try {
    return (await storage.persisted()) || (await storage.persist());
  } catch {
    return false;
  }
}
