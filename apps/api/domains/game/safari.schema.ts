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

export const expRewardSchema = z.object({
  gained: z.number().int().nonnegative(),
  level: z.number().int().min(1).max(50),
  exp: z.number().int().nonnegative(),
  leveledUp: z.boolean(),
});

export type ExpReward = z.infer<typeof expRewardSchema>;

export const catchWildResultSchema = z.object({
  result: z.enum(['caught', 'fail', 'flee']),
  pokemon: z.any().optional(),
  reward: z
    .object({
      candyId: z.string(),
      candyQuantity: z.number().int().nonnegative(),
    })
    .optional(),
  expReward: expRewardSchema.optional(),
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
