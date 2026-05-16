import { z } from 'zod';

export const restoreFossilSchema = z.object({
  id: z.number().int().min(1).max(15),
});

export type RestoreFossilInput = z.infer<typeof restoreFossilSchema>;
