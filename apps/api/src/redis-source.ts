import * as dotenv from "dotenv";
import { createClient } from "redis";

dotenv.config();

export const redis = createClient({
  url: "redis://redis:6379",
});
