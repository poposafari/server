import { z } from 'zod';

export const evolveSchema = z.object({
  id: z.number().int().positive(),
  cost: z.string().min(1),
});

export const sellSchema = z.object({
  id: z.number().int().positive(),
});

export const learnMoveSchema = z.object({
  id: z.number().int().positive(),
  move: z.string().startsWith('move_'),
});
