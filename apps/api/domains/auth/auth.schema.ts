import { z } from 'zod';

export const authLocalSchema = z.object({
  username: z
    .string()
    .min(6)
    .max(20)
    .regex(/^[a-zA-Z0-9]+$/),
  password: z
    .string()
    .min(6)
    .max(20)
    .regex(/^[a-zA-Z0-9]+$/),
});
