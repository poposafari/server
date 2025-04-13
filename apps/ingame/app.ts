import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import ingameRouter from "./src/routes/ingame.route";
import itemSlotRouter from "./src/routes/itemslot.route";
import ticketRouter from "./src/routes/ticket.route";

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use("/ingame", ingameRouter);
app.use("/ingame/itemslot", itemSlotRouter);
app.use("/ingame/ticket", ticketRouter);

export default app;
