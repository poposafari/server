import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode } from '@poposerver/lib/types';

export function zodValidate(schema: ZodSchema) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      throw new AppError(
        result.error.issues.map((i) => i.message).join(', '),
        400,
        AppErrorCode.DTO_INVALID,
      );
    }
    request.body = result.data;
  };
}
