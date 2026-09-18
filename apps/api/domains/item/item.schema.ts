import { z } from 'zod';

export const itemParamsSchema = z.object({
  itemId: z.string().min(1),
});

export type ItemParams = z.infer<typeof itemParamsSchema>;

export const sellItemSchema = z.object({
  quantity: z.number().int().positive(),
});

export type SellItemInput = z.infer<typeof sellItemSchema>;

export const buyItemSchema = z.object({
  quantity: z.number().int().positive().max(9999),
});

export type BuyItemInput = z.infer<typeof buyItemSchema>;

export const heldItemParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type HeldItemParams = z.infer<typeof heldItemParamsSchema>;

export const giveHoldSchema = z.object({
  heldItem: z.string().min(1),
});

export type GiveHoldInput = z.infer<typeof giveHoldSchema>;

export const updateItemSchema = z.object({
  register: z.boolean(),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;
