import { Router } from "express";
import { IngameController } from "../controllers/ingame.controller";
import { authenticate } from "../share/authenicate.middleware";

const itemSlotRouter = Router();

itemSlotRouter.post("/update", authenticate, IngameController.updateItemSlot);

export default itemSlotRouter;
