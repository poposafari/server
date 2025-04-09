import { DataSource } from "typeorm";

import * as dotenv from "dotenv";
import { Account } from "../entities/Account";
import { Bag } from "../entities/Bag";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_0_NAME,
  port: Number(process.env.DB_0_PORT),
  username: process.env.DB_0_USERNAME,
  password: process.env.DB_0_PASSWORD,
  database: process.env.DB_0_NAME,
  entities: [Account, Bag],
  synchronize: true,
  logging: true,
});

// ! synchronize가 true라면, @Entity()로 정의한 클래스에 따라 테이블이 만들어지거나 변경.
// ! 즉, 서버가 다시 켜지면, 모든 데이터가 날아간다. 그러니깐, 제발 실 운영환경에서는 false로 바꾸자.
