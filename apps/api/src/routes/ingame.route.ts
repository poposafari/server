import { Router } from "express";
import { IngameController } from "../controllers/ingame.controller";
import { authenticate } from "../utils/authenicate.middleware";

const ingameRouter = Router();

ingameRouter.post("/register", IngameController.register);
ingameRouter.get("/userdata", authenticate, IngameController.getUserData);

export default ingameRouter;
