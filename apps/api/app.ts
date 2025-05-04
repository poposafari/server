import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { HttpError } from "./src/utils/http-error";
import routes from "./src/routes";

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use("/api/account", routes.AccountRouter);
app.use("/api/ingame", routes.IngameRouter);
app.use("/api/slot", routes.SlotRouter);
app.use("/api/ticket", routes.TicketRouter);
app.use("/api/bag", routes.BagRouter);
app.use("/api/pokebox", routes.PokeboxRouter);
app.use("/api/safari", routes.SafariRouter);

app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json(err.toJson());
  }

  console.error("Server Error!", err);
  return res.status(500).json({ error: "Internal Server Error" });
});

export default app;
