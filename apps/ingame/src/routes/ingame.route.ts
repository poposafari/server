import { Router } from "express";
import { IngameController } from "../controllers/ingame.controller";

const ingameRouter = Router();

ingameRouter.post("/register", IngameController.register);

export default ingameRouter;
