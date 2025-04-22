import { Router } from "express";
import { IngameController } from "../controllers/ingame.controller";
import { authenticate } from "../utils/authenicate.middleware";

const slotRouter = Router();

slotRouter.post("/item/update", authenticate, IngameController.updateItemSlot);
slotRouter.post("/party/update", authenticate, IngameController.updateParty);
slotRouter.post("/bg/update", authenticate, IngameController.updatePokeboxBg);

export default slotRouter;
