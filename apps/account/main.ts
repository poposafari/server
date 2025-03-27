import app from "./app";
import * as dotenv from "dotenv";
import "reflect-metadata";
import { AppDataSource } from "./src/db/data-source";

dotenv.config();

const PORT = process.env.SERVICE_ACCOUNT_PORT;

AppDataSource.initialize()
  .then(() => {
    console.log("database connected");
    app.listen(PORT, () => {
      console.log(`account service is running on port ${PORT}`);
    });
  })
  .catch((err: Error) => {
    console.error("database connection failed:", err);
  });
