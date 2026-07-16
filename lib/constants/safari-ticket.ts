export const SAFARI_TICKET_ITEM_ID = 'safari-zone-ticket';
export const SAFARI_TICKET_REGEN_INTERVAL_MS = 8 * 60 * 60 * 1000; // 8시간
export const SAFARI_TICKET_MAX_STOCK = 3;

export interface SafariTicketState {
  available: number;
  cap: number;
  nextTicketAt: number | null;
  nextTicketInMs: number | null;
}

export function computeSafariTicketState(regenAt: Date, now: Date): SafariTicketState {
  const elapsed = now.getTime() - regenAt.getTime();
  const available = Math.max(
    0,
    Math.min(SAFARI_TICKET_MAX_STOCK, Math.floor(elapsed / SAFARI_TICKET_REGEN_INTERVAL_MS)),
  );

  if (available >= SAFARI_TICKET_MAX_STOCK) {
    return { available, cap: SAFARI_TICKET_MAX_STOCK, nextTicketAt: null, nextTicketInMs: null };
  }

  const nextTicketAt = regenAt.getTime() + (available + 1) * SAFARI_TICKET_REGEN_INTERVAL_MS;
  return {
    available,
    cap: SAFARI_TICKET_MAX_STOCK,
    nextTicketAt,
    nextTicketInMs: Math.max(0, nextTicketAt - now.getTime()),
  };
}

export function advanceSafariTicketAnchor(regenAt: Date, now: Date, claimed: number): Date {
  if (claimed >= SAFARI_TICKET_MAX_STOCK) {
    return now;
  }
  return new Date(regenAt.getTime() + claimed * SAFARI_TICKET_REGEN_INTERVAL_MS);
}
