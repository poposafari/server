import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { envConfig, logger, publishSocketMaintenance } from '@poposerver/lib';

const INTERNAL_TOKEN_HEADER = 'x-internal-token';

export default async function internalRoutes(app: FastifyInstance) {
  const requireInternalToken = (request: FastifyRequest, reply: FastifyReply): boolean => {
    const expected = envConfig.INTERNAL_TOKEN;
    if (!expected) {
      reply.status(503).send({ success: false, error: 'INTERNAL_TOKEN not configured' });
      return false;
    }
    const provided = request.headers[INTERNAL_TOKEN_HEADER];
    if (!provided || provided !== expected) {
      reply.status(401).send({ success: false, error: 'invalid internal token' });
      return false;
    }
    return true;
  };

  app.post('/maintenance/broadcast', async (request, reply) => {
    if (!requireInternalToken(request, reply)) return;
    try {
      await publishSocketMaintenance();
      logger.info('[Internal] maintenance broadcast published');
      return reply.status(200).send({ success: true, data: null });
    } catch (err) {
      logger.error('[Internal] maintenance broadcast failed:', err);
      return reply.status(500).send({ success: false, error: 'publish failed' });
    }
  });
}
