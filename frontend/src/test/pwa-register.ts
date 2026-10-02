/** Stand-in for vite-plugin-pwa's virtual module in tests. */
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
