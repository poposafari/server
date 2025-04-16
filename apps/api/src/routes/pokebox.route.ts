import { Router } from "express";
import { IngameController } from "../controllers/ingame.controller";
import { authenticate } from "../utils/authenicate.middleware";
import { PokeboxController } from "../controllers/pokebox.controller";

const pokeboxRouter = Router();

pokeboxRouter.post("/bg", authenticate, IngameController.updatePokeboxBg);
pokeboxRouter.post("/add", authenticate, PokeboxController.addPokemon);

export default pokeboxRouter;
