import cron from "node-cron";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { increaseTicketJob } from "./job";

const app = express();

const test = "* * * * *";
const base = "0 0,6,12,18 * * *";

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

cron.schedule(base, async () => {
  console.log("--run increase user ticket--");
  await increaseTicketJob();
});

export default app;
