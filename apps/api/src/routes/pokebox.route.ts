import { Router } from "express";
import { IngameController } from "../controllers/ingame.controller";
import { authenticate } from "../utils/authenicate.middleware";

const pokeboxRouter = Router();

pokeboxRouter.post("/bg", authenticate, IngameController.updatePokeboxBg);

export default pokeboxRouter;
