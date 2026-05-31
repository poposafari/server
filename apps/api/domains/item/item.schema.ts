import { z } from 'zod';

export const sellItemSchema = z.object({
  item: z.string().min(1),
  quantity: z.number().int().positive(),
});

export type SellItemInput = z.infer<typeof sellItemSchema>;

export const buyItemSchema = z.object({
  item: z.string().min(1),
  quantity: z.number().int().positive().max(9999),
});

export type BuyItemInput = z.infer<typeof buyItemSchema>;

export const giveHoldSchema = z.object({
  userPokemonId: z.number().int().positive(),
  heldItem: z.string().min(1),
});

export type GiveHoldInput = z.infer<typeof giveHoldSchema>;

export const takeHoldSchema = z.object({
  id: z.number().int().positive(),
});

export type TakeHoldInput = z.infer<typeof takeHoldSchema>;

export const registerItemSchema = z.object({
  itemId: z.string().min(1),
});

export type RegisterItemInput = z.infer<typeof registerItemSchema>;

export const unregisterItemSchema = z.object({
  itemId: z.string().min(1),
});

export type UnregisterItemInput = z.infer<typeof unregisterItemSchema>;
