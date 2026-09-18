import { Request, Response, Router } from 'express';
import { envConfig, logger, publishSocketMaintenance } from '@poposerver/lib';

const INTERNAL_TOKEN_HEADER = 'x-internal-token';

const router = Router();

const requireInternalToken = (req: Request, res: Response): boolean => {
  const expected = envConfig.INTERNAL_TOKEN;
  if (!expected) {
    res.status(503).json({ success: false, error: 'INTERNAL_TOKEN not configured' });
    return false;
  }
  const provided = req.headers[INTERNAL_TOKEN_HEADER];
  if (!provided || provided !== expected) {
    res.status(401).json({ success: false, error: 'invalid internal token' });
    return false;
  }
  return true;
};

router.post('/maintenance/broadcast', async (req, res) => {
  if (!requireInternalToken(req, res)) return;
  try {
    await publishSocketMaintenance();
    logger.info('[Internal] maintenance broadcast published');
    return res.status(200).json({ success: true, data: null });
  } catch (err) {
    logger.error('[Internal] maintenance broadcast failed:', err);
    return res.status(500).json({ success: false, error: 'publish failed' });
  }
});

export default router;
