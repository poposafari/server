import { z } from 'zod';

export const enterSafariSchema = z.object({
  mapId: z.string().regex(/^s\d{3}$/),
});

export type EnterSafariInput = z.infer<typeof enterSafariSchema>;
