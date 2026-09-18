import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode } from '@poposerver/lib/types';

function parseOrThrow(schema: ZodSchema, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      result.error.issues.map((i) => i.message).join(', '),
      400,
      AppErrorCode.DTO_INVALID,
    );
  }
  return result.data;
}

export function zodValidate(schemas: { body?: ZodSchema; params?: ZodSchema }) {
  return async function (req: Request, _res: Response, next: NextFunction) {
    if (schemas.params) {
      req.params = parseOrThrow(schemas.params, req.params) as typeof req.params;
    }
    if (schemas.body) {
      req.body = parseOrThrow(schemas.body, req.body);
    }
    next();
  };
}
