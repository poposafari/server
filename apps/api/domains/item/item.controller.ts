import { FastifyRequest, FastifyReply } from 'fastify';
import { AuditAction } from '@poposerver/lib/types';
import { ItemService } from './item.service';
import { HeldItemParams, ItemParams } from './item.schema';

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
    const { itemId } = request.params as ItemParams;
    const { quantity } = request.body as { quantity: number };
    const data = await this.itemService.buy(request.authId, { item: itemId, quantity }, request.ip);
    return reply.status(200).send({ success: true, data });
  };

  sell = async (request: FastifyRequest, reply: FastifyReply) => {
    const { itemId } = request.params as ItemParams;
    const { quantity } = request.body as { quantity: number };
    const data = await this.itemService.sell(
      request.authId,
      { item: itemId, quantity },
      request.ip,
    );
    return reply.status(200).send({ success: true, data });
  };

  giveHold = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as HeldItemParams;
    const { heldItem } = request.body as { heldItem: string };
    const body = { userPokemonId: id, heldItem };
    const data = await this.itemService.giveHold(request.authId, body);
    request.audit = {
      action: AuditAction.ITEM_GIVE_HOLD,
      detail: { userPokemonId: body.userPokemonId, heldItem: body.heldItem },
    };
    return reply.status(200).send({ success: true, data });
  };

  takeHold = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as HeldItemParams;
    const body = { id };
    const data = await this.itemService.takeHold(request.authId, body);
    request.audit = {
      action: AuditAction.ITEM_TAKE_HOLD,
      detail: { userPokemonId: body.id },
    };
    return reply.status(200).send({ success: true, data });
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { itemId } = request.params as ItemParams;
    const { register } = request.body as { register: boolean };
    const data = await this.itemService.setRegister(request.authId, itemId, register);
    request.audit = {
      action: register ? AuditAction.ITEM_REGISTER : AuditAction.ITEM_UNREGISTER,
      detail: { itemId },
    };
    return reply.status(200).send({ success: true, data });
  };
}
