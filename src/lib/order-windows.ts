// How far back the Orders (confirmer) page looks.

/** "Placed within" choices, in days. */
export const ORDER_WINDOWS = [30, 60, 120] as const;
export const DEFAULT_ORDER_WINDOW = 60;
/** Upper bound for a custom `?days=` typed into the URL. */
export const MAX_ORDER_WINDOW = 365;
