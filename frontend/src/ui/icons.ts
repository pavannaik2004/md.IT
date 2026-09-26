export type IconName =
  | 'file' | 'folder' | 'folder-open' | 'chevron-right' | 'chevron-down' | 'plus' | 'search' | 'copy'
  | 'check' | 'x' | 'more' | 'columns' | 'pencil' | 'eye' | 'history' | 'cloud' | 'alert' | 'info'
  | 'trash' | 'download' | 'image' | 'sliders' | 'sidebar' | 'user';

type IconPath = readonly [d: string, strokeWidth?: number];

/** Paths copied from the design system bundle: 24px grid, 1.5 stroke, round caps and joins. */
export const ICONS: Record<IconName, readonly IconPath[]> = {
  file: [['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z'], ['M14 3v5h5']],
  folder: [['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z']],
  'folder-open': [
    ['M3 17V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1'],
    ['M3 17l2.3-5.8A2 2 0 0 1 7.2 10H21l-2.5 7.6A2 2 0 0 1 16.6 19H5a2 2 0 0 1-2-2z'],
  ],
  'chevron-right': [['M9.5 6.5l5.5 5.5-5.5 5.5']],
  'chevron-down': [['M6.5 9.5l5.5 5.5 5.5-5.5']],
  plus: [['M12 5v14M5 12h14']],
  search: [['M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0z'], ['M20 20l-4.3-4.3']],
  copy: [
    ['M10 8h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z'],
    ['M15 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4'],
  ],
  check: [['M5 12.5l4.5 4.5L19 7.5']],
  x: [['M6.5 6.5l11 11M17.5 6.5l-11 11']],
  more: [['M6 12h.01M12 12h.01M18 12h.01', 2.6]],
  columns: [['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'], ['M12 4v16']],
  pencil: [['M4 20h4L19.3 8.7a2.1 2.1 0 0 0-3-3L5 17v3'], ['M14.5 7.5l2 2']],
  eye: [
    ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'],
    ['M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z'],
  ],
  history: [['M3.5 12A8.5 8.5 0 1 0 6 6'], ['M3.5 3.5V8H8'], ['M12 8v4l3 2']],
  cloud: [['M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.3 9.3 4.6 4.6 0 0 0 7 18.5z']],
  alert: [
    ['M10.3 4.9a2 2 0 0 1 3.4 0l7.1 12.4a2 2 0 0 1-1.7 3H4.9a2 2 0 0 1-1.7-3z'],
    ['M12 10v4'],
    ['M12 17h.01', 2.4],
  ],
  info: [['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'], ['M12 11v5'], ['M12 8h.01', 2.4]],
  trash: [['M4 7h16'], ['M10 11v6M14 11v6'], ['M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12'], ['M9 7V4h6v3']],
  download: [['M12 4v11'], ['M7 10l5 5 5-5'], ['M5 20h14']],
  image: [
    ['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'],
    ['M4 16l5-5 4 4 2-2 5 5'],
    ['M16 8.5h.01', 2.6],
  ],
  sliders: [['M4 7h10M18 7h2M4 17h4M12 17h8'], ['M16 5v4M10 15v4']],
  sidebar: [['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'], ['M9.5 4v16']],
  user: [['M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z'], ['M4.5 20.5a7.5 7.5 0 0 1 15 0']],
};
