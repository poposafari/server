import { FastifyReply, FastifyRequest } from 'fastify';
import { AuditAction } from '@poposerver/lib/types';
import { SafariService } from './safari.service';

export class SafariController {
  constructor(private readonly service: SafariService) {}
  enter = async (request: FastifyRequest, reply: FastifyReply) => {
    const { mapId, needEntry } = request.body as { mapId: string; needEntry: boolean };
    const data = await this.service.enter(request.authId!, mapId, needEntry, request.ip);
    return reply.status(200).send({ success: true, data });
  };

  pickItem = async (request: FastifyRequest, reply: FastifyReply) => {
    const { uid } = request.body as { uid: string };
    const data = await this.service.pickItem(request.authId!, uid);
    request.audit = {
      action: AuditAction.SAFARI_PICK_ITEM,
      detail: { uid, itemId: data.itemId },
    };
    return reply.status(200).send({ success: true, data });
  };

  // catchWild: 트랜잭션 결합 기록(service의 auditTx). request.audit 세팅하지 않음(중복 방지).
  catchWild = async (request: FastifyRequest, reply: FastifyReply) => {
    const { uid } = request.body as { uid: string };
    const data = await this.service.catchWild(request.authId!, uid, request.ip);
    return reply.status(200).send({ success: true, data });
  };

  baitWild = async (request: FastifyRequest, reply: FastifyReply) => {
    const { uid } = request.body as { uid: string };
    const data = await this.service.baitWild(request.authId!, uid);
    request.audit = { action: AuditAction.SAFARI_BAIT, detail: { uid, result: data.result } };
    return reply.status(200).send({ success: true, data });
  };

  rockWild = async (request: FastifyRequest, reply: FastifyReply) => {
    const { uid } = request.body as { uid: string };
    const data = await this.service.rockWild(request.authId!, uid);
    request.audit = { action: AuditAction.SAFARI_ROCK, detail: { uid, result: data.result } };
    return reply.status(200).send({ success: true, data });
  };

  exit = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.service.exit(request.authId!);
    // request.audit = { action: AuditAction.SAFARI_EXIT, detail: { mapId: data.mapId } };
    return reply.status(200).send({ success: true, data });
  };
}
