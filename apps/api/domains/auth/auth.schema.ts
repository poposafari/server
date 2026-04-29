import { z } from 'zod';

export const authLocalSchema = z.object({
  username: z
    .string()
    .min(6, 'Username must be at least 6 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-z0-9]+$/, 'Username must contain only lowercase letters and numbers'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(20, 'Password must be at most 20 characters')
    .regex(/^[a-zA-Z0-9!@#$%^&*]+$/, 'Password contains invalid characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type AuthLocalInput = z.infer<typeof authLocalSchema>;

export const loginLocalSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

export type LoginLocalInput = z.infer<typeof loginLocalSchema>;
