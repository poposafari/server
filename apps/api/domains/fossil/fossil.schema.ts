import { z } from 'zod';

export const restoreFossilParamsSchema = z.object({
  fossilId: z.coerce.number().int().min(1).max(15),
});

export type RestoreFossilParams = z.infer<typeof restoreFossilParamsSchema>;
