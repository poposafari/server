import { z } from 'zod';

export const enterSafariSchema = z.object({
  mapId: z.string().regex(/^s\d{3}$/),
});

export type EnterSafariInput = z.infer<typeof enterSafariSchema>;

export const pickItemSchema = z.object({
  uid: z.string().uuid(),
});

export type PickItemInput = z.infer<typeof pickItemSchema>;
