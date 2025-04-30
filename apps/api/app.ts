import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import accountRouter from "./src/routes/account.route";
import ingameRouter from "./src/routes/ingame.route";
import slotRouter from "./src/routes/slot.route";
import ticketRouter from "./src/routes/ticket.route";
import bagRouter from "./src/routes/bag.route";
import pokeboxRouter from "./src/routes/pokebox.route";
import safariRouter from "./src/routes/safari.route";

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use("/api/account", accountRouter);
app.use("/api/ingame", ingameRouter);
app.use("/api/slot", slotRouter);
app.use("/api/ticket", ticketRouter);
app.use("/api/bag", bagRouter);
app.use("/api/pokebox", pokeboxRouter);
app.use("/api/safari", safariRouter);

export default app;
