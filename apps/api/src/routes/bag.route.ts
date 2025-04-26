import { Router } from "express";
import { authenticate } from "../utils/authenicate.middleware";
import { BagController } from "../controllers/bag.controller";

const bagRouter = Router();

bagRouter.post("/add", authenticate, BagController.addItem);
bagRouter.post("/use", authenticate, BagController.useItem);
bagRouter.post("/category", authenticate, BagController.getItems);
bagRouter.get("/all", authenticate, BagController.getAllItems);

export default bagRouter;
