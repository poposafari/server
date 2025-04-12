import { Ingame } from "./entities/Ingame";
import { AppDataSource } from "./db/data-source";

export const increaseTicketJob = async () => {
  const repo = AppDataSource.getRepository(Ingame);

  await repo
    .createQueryBuilder()
    .update(Ingame)
    .set({ available_ticket: () => "available_ticket + 1" })
    .where("available_ticket < :max", { max: 8 })
    .execute();
};
