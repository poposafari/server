import { z } from 'zod';

export const enterSafariSchema = z.object({
  mapId: z.string().regex(/^s\d{3}$/),
  needEntry: z.boolean(),
});

export type EnterSafariInput = z.infer<typeof enterSafariSchema>;

export const pickItemSchema = z.object({
  uid: z.string().uuid(),
});

export type PickItemInput = z.infer<typeof pickItemSchema>;

export const catchWildSchema = z.object({
  uid: z.string().uuid(),
  bait: z.boolean(),
  rock: z.boolean(),
});

export type CatchWildInput = z.infer<typeof catchWildSchema>;
