import { z } from 'zod';

export const evolveSchema = z.object({
  id: z.number().int().positive(),
  cost: z.string().min(1),
});

export const sellSchema = z.object({
  id: z.number().int().positive(),
});

export const EXP_CANDY_ITEM_IDS = [
  'experience-candy-xs',
  'experience-candy-s',
  'experience-candy-m',
  'experience-candy-l',
  'experience-candy-xl',
] as const;

export const enhanceSchema = z.object({
  id: z.number().int().positive(),
  candies: z
    .array(
      z.object({
        itemId: z.enum(EXP_CANDY_ITEM_IDS),
        count: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(EXP_CANDY_ITEM_IDS.length),
});

export type EnhanceInput = z.infer<typeof enhanceSchema>;

export const learnMoveSchema = z.object({
  id: z.number().int().positive(),
  move: z.string().startsWith('move_'),
});

export const arrangeSchema = z.object({
  changes: z
    .array(
      z.object({
        id: z.number().int().positive(),
        boxNumber: z.number().int().min(1).max(30).nullable(),
        gridNumber: z.number().int().min(0).max(29).nullable(),
        partySlot: z.number().int().min(0).max(5).nullable(),
      }),
    )
    .max(100),
  boxMeta: z
    .array(
      z.object({
        boxNumber: z.number().int().min(1).max(30),
        wallpaper: z.number().int().min(0).max(32),
        name: z.string().max(20),
      }),
    )
    .max(30)
    .optional(),
  nicknames: z
    .array(
      z.object({
        id: z.number().int().positive(),
        nickname: z.string().max(20).nullable(),
      }),
    )
    .max(100)
    .optional(),
});
