import { Router } from "express";
import { authenticate } from "../utils/authenicate.middleware";
import { SafariController } from "../controllers/safari.controller";

const safariRouter = Router();

safariRouter.post("/ticket", authenticate, SafariController.useTicket);

export default safariRouter;
