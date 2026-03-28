import { CostumeRepository } from './costume.repository';

export class CostumeService {
  constructor(private readonly repo: CostumeRepository) {}

  async getAll(authId: string) {
    return this.repo.findAllByAccountId(Number(authId));
  }
}
