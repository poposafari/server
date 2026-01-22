import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../audit/audit.service';
import { CreateUserReq, GetUserRes } from './user.dto';
import { UserService } from './user.service';
import { AppError, AppErrorCode, AppErrorMessage, AuditAction } from '@poposerver/shared';
import { AuthenticatedRequest } from 'apps/api/middlewares/jwt.middleware';
import { logger } from '@poposerver/shared/utils/logger';

export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly auditService: AuditService,
  ) {}

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      logger.debug(`CreateUser attempt: authId=${authReq.user!.authId}`);
      const request: CreateUserReq = req.body;
      const result = await this.userService.createUser(authReq.user!.authId, request);

      this.auditService.log(authReq.user!.authId, AuditAction.CREATE_USER, req.ip || '');
      logger.info(
        `CreateUser success: authId=${authReq.user!.authId}, nickname=${request.nickname}`,
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.warn(`CreateUser error: ${JSON.stringify(error)}`);
      next(error);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      logger.debug(`GetUser attempt: authId=${authReq.user!.authId}`);
      const result = await this.userService.getUser(authReq.user!.authId);

      logger.info(`GetUser success: authId=${authReq.user!.authId}`);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.warn(`GetUser error: ${JSON.stringify(error)}`);
      next(error);
    }
  };
}
