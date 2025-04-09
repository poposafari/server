import { Router } from "express";
import { authenticate } from "../share/authenicate.middleware";
import { BagController } from "../controllers/bag.controller";

const bagRouter = Router();

bagRouter.post("/add", authenticate, BagController.addItem);

export default bagRouter;
