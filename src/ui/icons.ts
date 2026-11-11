/** Pictogrammes au trait (24 × 24), dessinés pour l’appli. */
export const ICONS = {
  bottle: '<path d="M10 7V5.5a2 2 0 0 1 4 0V7"/><rect x="7.5" y="7" width="9" height="14" rx="2.5"/><path d="M7.5 11h3.5M7.5 14.5h3.5M7.5 18h3.5"/>',
  breastfeeding: '<circle cx="9" cy="5" r="2.2"/><path d="M5 21v-6a4 4 0 0 1 4-4h1.5"/><circle cx="16" cy="12.5" r="2.2"/><path d="M8 15.5c2.5 2.2 6.5 2.2 10 0"/>',
  pumping: '<path d="M3.5 4.5 11 9v2l-7.5 4.5z"/><rect x="11" y="8" width="7.5" height="12.5" rx="2"/><path d="M11 12.5h3M11 16h3"/>',
  diaper: '<path d="M3 7h18v2.5a9 9 0 0 1-18 0z"/><path d="M3 10.5h3.5M17.5 10.5H21M9 18.5c1-1.5 1.8-2.2 3-2.2s2 .7 3 2.2"/>',
  medication: '<rect x="2.6" y="8.6" width="13" height="6.8" rx="3.4" transform="rotate(-45 9.1 12)"/><path d="M6.7 14.4l4.8-4.8"/><circle cx="17.5" cy="17.5" r="3.5"/><path d="M15 17.5h5"/>',
  sleep: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"/><path d="M15 3h4l-4 4h4"/>',
  solid: '<path d="M5 3v5a2 2 0 0 0 4 0V3M7 3v18"/><path d="M17 21V3c-2 1.2-3 4-3 8.5h3"/>',
  temperature: '<path d="M14 14.5V5a2 2 0 0 0-4 0v9.5a4 4 0 1 0 4 0z"/><path d="M12 9v7.5"/>',
  tummy: '<circle cx="16.5" cy="9" r="2.5"/><path d="M3 19h18"/><path d="M5 19c1-3.2 4-5.2 8-5.2h3.2a3 3 0 0 1 3 3V19"/>',
  growth: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.3 10.2a5 5 0 0 1 7.4 0"/><path d="M12 10.8l1.6-2.1"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  book: '<path d="M12 6.5C10.5 5 8 4.5 4 4.5v14c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-14c-4 0-6.5.5-8 2z"/><path d="M12 6.5v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  back: '<path d="M14.5 6 8.5 12l6 6"/>',
  chevron: '<path d="M9.5 6l6 6-6 6"/>',
} as const;

export type IconName = keyof typeof ICONS;
