import { Router } from "express";
import { AccountController } from "../controllers/account.controller";

const accountRouter = Router();

accountRouter.post("/register", AccountController.register);
accountRouter.post("/login", AccountController.login);

export default accountRouter;
