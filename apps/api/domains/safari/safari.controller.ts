import { Request, Response } from 'express';
import { AuditAction } from '@poposerver/lib/types';
import { SafariService } from './safari.service';
import {
  CatchWildInput,
  FeedWildInput,
  SafariTargetParams,
  UseItemWildInput,
} from './safari.schema';

export class SafariController {
  constructor(private readonly service: SafariService) {}
  enter = async (req: Request, res: Response) => {
    const { mapId, needEntry } = req.body as { mapId: string; needEntry: boolean };
    const data = await this.service.enter(
      req.authId!,
      mapId,
      needEntry,
      req.receivedAt ?? Date.now(),
      req.ip,
    );
    return res.status(200).json({ success: true, data });
  };

  pickItem = async (req: Request, res: Response) => {
    const { uid } = req.params as unknown as SafariTargetParams;
    const data = await this.service.pickItem(req.authId!, uid, req.receivedAt ?? Date.now());
    req.audit = {
      action: AuditAction.SAFARI_PICK_ITEM,
      detail: { uid, itemId: data.itemId },
    };
    return res.status(200).json({ success: true, data });
  };

  // catchWild: 트랜잭션 결합 기록(service의 auditTx). req.audit 세팅하지 않음(중복 방지).
  catchWild = async (req: Request, res: Response) => {
    const { uid } = req.params as unknown as SafariTargetParams;
    const { ballId, spawnTile } = req.body as CatchWildInput;
    const data = await this.service.catchWild(
      req.authId!,
      uid,
      ballId,
      spawnTile ?? null,
      req.receivedAt ?? Date.now(),
      req.ip,
    );
    return res.status(200).json({ success: true, data });
  };

  feedWild = async (req: Request, res: Response) => {
    const { uid } = req.params as unknown as SafariTargetParams;
    const { itemId } = req.body as FeedWildInput;
    const data = await this.service.feedWild(
      req.authId!,
      uid,
      itemId,
      req.receivedAt ?? Date.now(),
      req.ip,
    );
    return res.status(200).json({ success: true, data });
  };

  useItemWild = async (req: Request, res: Response) => {
    const { uid } = req.params as unknown as SafariTargetParams;
    const { itemId } = req.body as UseItemWildInput;
    const data = await this.service.useItemWild(
      req.authId!,
      uid,
      itemId,
      req.receivedAt ?? Date.now(),
      req.ip,
    );
    return res.status(200).json({ success: true, data });
  };

  exit = async (req: Request, res: Response) => {
    const { fromMapId, ...data } = await this.service.exit(
      req.authId!,
      req.receivedAt ?? Date.now(),
    );
    req.audit = {
      action: AuditAction.SAFARI_EXIT,
      detail: { mapId: fromMapId, to: data.mapId },
    };
    return res.status(200).json({ success: true, data });
  };
}
