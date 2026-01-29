import { GLOBAL_NICKNAME_REGEX } from '@poposerver/shared';
import z from 'zod';

const MIN_NICKNAME_LENGTH = 1;
const MAX_NICKNAME_LENGTH = 12;
const RESERVED_WORDS = [
  'admin',
  'null',
  'undefined',
];

const createCostumePartSchema = (prefix: string, hasSeparator: boolean = true) => {
  const separator = hasSeparator ? '_' : '';
  const regex = new RegExp(`^${prefix}${separator}\\d+$`);
  const formatExample = hasSeparator ? `${prefix}_0` : `${prefix}0`;

  return z
  .string()
  .regex(regex, `Invalid format. Expected format like "${formatExample}"`)
  .refine((val) => {
    const numberPart = val.replace(prefix + separator, '');
    const number = Number(numberPart);
    return !isNaN(number) && number >= 0;
  }, `${prefix} number must be >= 0`);
};

const userAvatarDataSchema = z.object({
  skin: createCostumePartSchema('skin'),
  hair: createCostumePartSchema('hair'),
  hairColor: createCostumePartSchema('c', false),
  outfit: createCostumePartSchema('outfit'),
});

export const createUserSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(MIN_NICKNAME_LENGTH, 'Nickname must be at least 1 character')
    .max(MAX_NICKNAME_LENGTH, 'Nickname must be at most 12 characters')
    .regex(
      GLOBAL_NICKNAME_REGEX,
      `Nickname can only contain letters and numbers (no emojis or special characters). Example: ${GLOBAL_NICKNAME_REGEX.source}`,
    )
    .refine((val) => {
      const lowerVal = val.toLowerCase();
      const isReserved = RESERVED_WORDS.some((word) => lowerVal.includes(word));
      return !isReserved;
    }, `Nickname cannot contain reserved words. Reserved words: ${RESERVED_WORDS.join(', ')}`),
  gender: z.enum(['male', 'female'],),
  costume: userAvatarDataSchema,
});
