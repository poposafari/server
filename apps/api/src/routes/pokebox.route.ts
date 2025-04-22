import { Router } from "express";
import { IngameController } from "../controllers/ingame.controller";
import { authenticate } from "../utils/authenicate.middleware";
import { PokeboxController } from "../controllers/pokebox.controller";

const pokeboxRouter = Router();

pokeboxRouter.post("/add", authenticate, PokeboxController.addPokemon);
pokeboxRouter.post("/get", authenticate, PokeboxController.getPokebox);
pokeboxRouter.post("/move", authenticate, PokeboxController.moveBox);

export default pokeboxRouter;
