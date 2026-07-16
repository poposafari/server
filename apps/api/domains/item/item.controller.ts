import { FastifyRequest, FastifyReply } from 'fastify';
import { AuditAction } from '@poposerver/lib/types';
import { ItemService } from './item.service';

export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  getBag = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.itemService.getBag(request.authId);
    return reply.status(200).send({ success: true, data });
  };

  getSafariTicketStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.itemService.getSafariTicketStatus(request.authId);
    return reply.status(200).send({ success: true, data });
  };

  claimSafariTicket = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.itemService.claimSafariTicket(request.authId, request.ip);
    return reply.status(200).send({ success: true, data });
  };

  buy = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { item: string; quantity: number };
    const data = await this.itemService.buy(request.authId, body, request.ip);
    return reply.status(200).send({ success: true, data });
  };

  sell = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { item: string; quantity: number };
    const data = await this.itemService.sell(request.authId, body, request.ip);
    return reply.status(200).send({ success: true, data });
  };

  giveHold = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { userPokemonId: number; heldItem: string };
    const data = await this.itemService.giveHold(request.authId, body);
    request.audit = {
      action: AuditAction.ITEM_GIVE_HOLD,
      detail: { userPokemonId: body.userPokemonId, heldItem: body.heldItem },
    };
    return reply.status(200).send({ success: true, data });
  };

  takeHold = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { id: number };
    const data = await this.itemService.takeHold(request.authId, body);
    request.audit = {
      action: AuditAction.ITEM_TAKE_HOLD,
      detail: { userPokemonId: body.id },
    };
    return reply.status(200).send({ success: true, data });
  };

  register = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { itemId: string };
    const data = await this.itemService.register(request.authId, body);
    request.audit = {
      action: AuditAction.ITEM_REGISTER,
      detail: { itemId: body.itemId },
    };
    return reply.status(200).send({ success: true, data });
  };

  unregister = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { itemId: string };
    const data = await this.itemService.unregister(request.authId, body);
    request.audit = {
      action: AuditAction.ITEM_UNREGISTER,
      detail: { itemId: body.itemId },
    };
    return reply.status(200).send({ success: true, data });
  };
}
