import { Request, Response } from 'express';
import { AuditAction } from '@poposerver/lib/types';
import { UserService } from './user.service';
import { CreateUserInput } from './user.schema';

export class UserController {
  constructor(private readonly userService: UserService) {}

  createUser = async (req: Request, res: Response) => {
    const body = req.body as CreateUserInput;
    await this.userService.createUser(req.authId, body);
    req.audit = {
      action: AuditAction.CREATE_USER,
      detail: { nickname: body.nickname, gender: body.gender },
    };
    return res.status(201).json({ success: true, data: null });
  };

  getMe = async (req: Request, res: Response) => {
    const data = await this.userService.getMyGameData(req.authId);
    return res.status(200).json({ success: true, data });
  };
}
