import z from "zod";

const createCostumePartSchema = (prefix: string) => {
    return z
      .string()
      .regex(new RegExp(`^${prefix}_\\d+$`), `${prefix} must be in format "${prefix}_number"`)
      .refine((val) => {
        const [, number] = val.split('_');
        return Number(number) >= 0;
      }, `${prefix} number must be >= 0`);
  };
  
  const userAvatarDataSchema = z.object({
      skin: createCostumePartSchema('skin'),
      eye: createCostumePartSchema('eye'),
      hair: createCostumePartSchema('hair'),
      top: createCostumePartSchema('top'),
      bottom: createCostumePartSchema('bottom'),
      shoes: createCostumePartSchema('shoes'),
      etc1: createCostumePartSchema('etc1'),
      etc2: createCostumePartSchema('etc2'),
      etc3: createCostumePartSchema('etc3'),
  });
  
export const createUserSchema = z.object({
    nickname: z
        .string()
        .min(1, 'Nickname is required')
        .max(20, 'Nickname must be at most 20 characters')
        .regex(/^[\p{L}\p{N}]+$/u, 'Nickname can only contain letters and numbers (no emojis or special characters)'),
    gender: z.enum(['boy', 'girl']),
    costume: userAvatarDataSchema,
})