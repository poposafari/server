import { z } from 'zod';
import { GLOBAL_NICKNAME_REGEX } from '@poposerver/lib/types';

const RESERVED_WORDS = ['admin', 'null', 'undefined'];

export const createUserSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, 'Nickname must be at least 1 character')
    .max(12, 'Nickname must be at most 12 characters')
    .regex(GLOBAL_NICKNAME_REGEX, 'Nickname can only contain letters and numbers')
    .refine(
      (val) => !RESERVED_WORDS.some((w) => val.toLowerCase().includes(w)),
      'Nickname contains reserved word',
    ),
  gender: z.enum(['male', 'female']),
  costume: z.object({
    skin: z.string().regex(/^skin_\d+$/, 'Invalid skin format. Expected: skin_0'),
    hair: z.string().regex(/^hair_\d+_c\d+$/, 'Invalid hair format. Expected: hair_0_c0'),
    outfit: z.string().regex(/^outfit_\d+$/, 'Invalid outfit format. Expected: outfit_0'),
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
