import { AppError, AppErrorCode, AppErrorMessage, MasterData, UserBag } from '@poposerver/shared';
import { DataSource, EntityManager } from 'typeorm';
import { BagRepository } from './bag.repository';

const ITEM_QUANTITY_MAX = 999;

export class BagService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly bagRepository: BagRepository,
  ) {}

  async addItem(
    authId: string,
    item: string,
    quantity: number,
    manager?: EntityManager,
  ): Promise<UserBag> {
    if (!MasterData.getItem(item)) {
      throw new AppError(AppErrorMessage.NOT_FOUND, 404, AppErrorCode.NOT_FOUND);
    }

    if (quantity <= 0) {
      throw new AppError('Quantity must be greater than 0.', 400, AppErrorCode.DTO_INVALID);
    }

    const run = async (em: EntityManager): Promise<UserBag> => {
      const existing = await this.bagRepository.findOneByAuthIdAndItemId(authId, item, em);

      if (existing) {
        const newQuantity = existing.quantity + quantity;
        if (newQuantity > ITEM_QUANTITY_MAX) {
          throw new AppError(
            AppErrorMessage.BAG_QUANTITY_EXCEEDED,
            400,
            AppErrorCode.BAG_QUANTITY_EXCEEDED,
          );
        }
        existing.quantity = newQuantity;
        return this.bagRepository.save(existing, em);
      }

      if (quantity > ITEM_QUANTITY_MAX) {
        throw new AppError(
          AppErrorMessage.BAG_QUANTITY_EXCEEDED,
          400,
          AppErrorCode.BAG_QUANTITY_EXCEEDED,
        );
      }

      const entity = Object.assign(new UserBag(), {
        authId,
        itemId: item,
        quantity,
      });

      return this.bagRepository.save(entity, em);
    };

    if (manager) {
      return run(manager);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const saved = await run(queryRunner.manager);
      await queryRunner.commitTransaction();
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
