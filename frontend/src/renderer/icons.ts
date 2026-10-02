// The design system's copy and check icons as markup for rendered HTML (paths match src/ui/icons.ts).
const svg = (paths: readonly string[]) =>
  `<svg class="md-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths
    .map((d) => `<path d="${d}"></path>`)
    .join('')}</svg>`;

export const COPY_ICON = svg([
  'M10 8h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z',
  'M15 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4',
]);

export const CHECK_ICON = svg(['M5 12.5l4.5 4.5L19 7.5']);
