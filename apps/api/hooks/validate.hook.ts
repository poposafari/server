import { FastifyRequest, FastifyReply } from 'fastify';
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
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    if (schemas.params) {
      request.params = parseOrThrow(schemas.params, request.params);
    }
    if (schemas.body) {
      request.body = parseOrThrow(schemas.body, request.body);
    }
  };
}
