import { Router } from "express";
import { authenticate } from "../share/authenicate.middleware";
import { BagController } from "../controllers/bag.controller";

const bagRouter = Router();

bagRouter.post("/add", authenticate, BagController.addItem);
bagRouter.post("/use", authenticate, BagController.useItem);
bagRouter.post("/category", authenticate, BagController.getItems);

export default bagRouter;
