import { Router } from "express";
import { IngameController } from "../controllers/ingame.controller";
import { authenticate } from "../share/authenicate.middleware";

const ticketRouter = Router();

ticketRouter.get("/get", authenticate, IngameController.getAvailableTicket);
ticketRouter.get(
  "/receive",
  authenticate,
  IngameController.receiveAvailableTicket
);

export default ticketRouter;
