import { Auth, UserAuthProvider } from 'shared';
import { Repository } from 'typeorm';

export class AuthRepository {
  private authRepository: Repository<Auth>;

  constructor(repository: Repository<Auth>) {
    this.authRepository = repository;
  }

  async findByProviderAndProviderId(provider: string, providerId: string): Promise<Auth | null> {
    return this.authRepository.findOne({ where: { provider, providerId }, withDeleted: true });
  }

  async findByProviderIdWithPassword(
    type: UserAuthProvider,
    providerId: string,
  ): Promise<Auth | null> {
    return this.authRepository
      .createQueryBuilder('auth')
      .addSelect('auth.password')
      .where('auth.provider = :provider', { provider: 'local' })
      .andWhere('auth.providerId = :providerId', { providerId: providerId })
      .getOne();
  }

  async create(provider: UserAuthProvider, providerId: string, password: string): Promise<Auth> {
    const auth = this.authRepository.create({ provider, providerId, password });
    return this.authRepository.save(auth);
  }

  async softDelete(authId: string): Promise<void> {
    await this.authRepository.softDelete(authId);
  }

  async findByIdWithDeleted(authId: string): Promise<Auth | null> {
    return this.authRepository.findOne({ where: { id: authId }, withDeleted: true });
  }
}
