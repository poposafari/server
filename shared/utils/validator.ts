import z, { ZodError, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../lib/utils/error';
import { AppErrorCode } from '@poposerver/shared';

export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessages = error.issues.map((err) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });

      const message = `Validation failed: ${errorMessages.join(', ')}`;

      throw new AppError(message, 400, AppErrorCode.DTO_INVALID as AppErrorCode);
    }
    throw error;
  }
}

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = validateSchema(schema, req.body);
      (req as any).body = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
}
