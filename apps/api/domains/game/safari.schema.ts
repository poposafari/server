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
});

export type CatchWildInput = z.infer<typeof catchWildSchema>;

export const catchWildResultSchema = z.object({
  result: z.enum(['caught', 'fail', 'flee']),
  pokemon: z.any().optional(),
  rewards: z
    .array(
      z.object({
        itemId: z.string(),
        quantity: z.number().int().nonnegative(),
      }),
    )
    .optional(),
});

export type CatchWildResult = z.infer<typeof catchWildResultSchema>;

export const baitWildSchema = z.object({
  uid: z.string().uuid(),
});

export type BaitWildInput = z.infer<typeof baitWildSchema>;

export const rockWildSchema = z.object({
  uid: z.string().uuid(),
});

export type RockWildInput = z.infer<typeof rockWildSchema>;
