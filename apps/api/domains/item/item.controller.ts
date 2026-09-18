import { Request, Response } from 'express';
import { AuditAction } from '@poposerver/lib/types';
import { ItemService } from './item.service';
import { HeldItemParams, ItemParams } from './item.schema';

export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  getBag = async (req: Request, res: Response) => {
    const data = await this.itemService.getBag(req.authId);
    return res.status(200).json({ success: true, data });
  };

  getSafariTicketStatus = async (req: Request, res: Response) => {
    const data = await this.itemService.getSafariTicketStatus(req.authId);
    return res.status(200).json({ success: true, data });
  };

  claimSafariTicket = async (req: Request, res: Response) => {
    const data = await this.itemService.claimSafariTicket(req.authId, req.ip);
    return res.status(200).json({ success: true, data });
  };

  buy = async (req: Request, res: Response) => {
    const { itemId } = req.params as unknown as ItemParams;
    const { quantity } = req.body as { quantity: number };
    const data = await this.itemService.buy(req.authId, { item: itemId, quantity }, req.ip);
    return res.status(200).json({ success: true, data });
  };

  sell = async (req: Request, res: Response) => {
    const { itemId } = req.params as unknown as ItemParams;
    const { quantity } = req.body as { quantity: number };
    const data = await this.itemService.sell(req.authId, { item: itemId, quantity }, req.ip);
    return res.status(200).json({ success: true, data });
  };

  giveHold = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as HeldItemParams;
    const { heldItem } = req.body as { heldItem: string };
    const body = { userPokemonId: id, heldItem };
    const data = await this.itemService.giveHold(req.authId, body);
    req.audit = {
      action: AuditAction.ITEM_GIVE_HOLD,
      detail: { userPokemonId: body.userPokemonId, heldItem: body.heldItem },
    };
    return res.status(200).json({ success: true, data });
  };

  takeHold = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as HeldItemParams;
    const body = { id };
    const data = await this.itemService.takeHold(req.authId, body);
    req.audit = {
      action: AuditAction.ITEM_TAKE_HOLD,
      detail: { userPokemonId: body.id },
    };
    return res.status(200).json({ success: true, data });
  };

  update = async (req: Request, res: Response) => {
    const { itemId } = req.params as unknown as ItemParams;
    const { register } = req.body as { register: boolean };
    const data = await this.itemService.setRegister(req.authId, itemId, register);
    req.audit = {
      action: register ? AuditAction.ITEM_REGISTER : AuditAction.ITEM_UNREGISTER,
      detail: { itemId },
    };
    return res.status(200).json({ success: true, data });
  };
}
