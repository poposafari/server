import { z } from 'zod';

export const enterSafariSchema = z.object({
  mapId: z.string().regex(/^s\d{3}$/),
  needEntry: z.boolean(),
});

export type EnterSafariInput = z.infer<typeof enterSafariSchema>;

export const safariTargetParamsSchema = z.object({
  uid: z.string().uuid(),
});

export type SafariTargetParams = z.infer<typeof safariTargetParamsSchema>;

export const feedWildSchema = z.object({
  itemId: z.string().regex(/^[a-z]+-gummi$/),
});

export type FeedWildInput = z.infer<typeof feedWildSchema>;

export const useItemWildSchema = z.object({
  itemId: z.enum(['mud', 'balm']),
});

export type UseItemWildInput = z.infer<typeof useItemWildSchema>;

export const catchWildResultSchema = z.object({
  result: z.enum(['caught', 'fail', 'flee', 'level_cap']),
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
