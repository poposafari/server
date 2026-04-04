import { z } from 'zod';

export const sellItemSchema = z.object({
  item: z.string().min(1),
  quantity: z.number().int().positive(),
});

export type SellItemInput = z.infer<typeof sellItemSchema>;

export const buyItemSchema = z.object({
  item: z.string().min(1),
  quantity: z.number().int().positive(),
});

export type BuyItemInput = z.infer<typeof buyItemSchema>;
