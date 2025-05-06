import { Router } from "express";
import { Controllers } from "./controllers";
import { Authenticate } from "./middlewares/authenicate.middleware";
import { Usercheck } from "./middlewares/usercheck.middleware";

//Account
const AccountRouter = Router();
console.log(Controllers.Account);
AccountRouter.post("/register", Controllers.Account.register);
AccountRouter.post("/login", Controllers.Account.login);
AccountRouter.get("/logout", Authenticate, Controllers.Account.logout);
AccountRouter.get("/delete", Authenticate, Usercheck, Controllers.Account.removeAccount);
AccountRouter.get("/auto-login", Authenticate, Usercheck, Controllers.Account.autoLogin);

//Slot
const SlotRouter = Router();
SlotRouter.post("/item/update", Authenticate, Usercheck, Controllers.Ingame.updateItemSlot);
SlotRouter.post("/party/update", Authenticate, Usercheck, Controllers.Ingame.updateParty);
SlotRouter.post("/bg/update", Authenticate, Usercheck, Controllers.Ingame.updatePokeboxBg);

//Ticket
const TicketRouter = Router();
TicketRouter.get("/get", Authenticate, Usercheck, Controllers.Ingame.getAvailableTicket);
TicketRouter.get("/receive", Authenticate, Usercheck, Controllers.Ingame.receiveAvailableTicket);

//Ingame
const IngameRouter = Router();
IngameRouter.post("/register", Authenticate, Controllers.Ingame.register);
IngameRouter.get("/userdata", Authenticate, Usercheck, Controllers.Ingame.getUserData);

//Bag
const BagRouter = Router();
BagRouter.post("/add", Authenticate, Usercheck, Controllers.Bag.addItem);
BagRouter.post("/use", Authenticate, Usercheck, Controllers.Bag.useItem);
BagRouter.post("/all", Authenticate, Usercheck, Controllers.Bag.getItems);
BagRouter.get("/category", Authenticate, Usercheck, Controllers.Bag.getItemByCategory);
BagRouter.post("/buy", Authenticate, Usercheck, Controllers.Bag.buyItem);

//Pokebox
const PokeboxRouter = Router();
PokeboxRouter.post("/add", Authenticate, Usercheck, Controllers.Pokebox.addPokemon);
PokeboxRouter.post("/get", Authenticate, Usercheck, Controllers.Pokebox.getPokebox);
PokeboxRouter.post("/move", Authenticate, Usercheck, Controllers.Pokebox.movePokemon);

//Safari
const SafariRouter = Router();
SafariRouter.post("/ticket", Authenticate, Usercheck, Controllers.Safari.useTicket);

export default { AccountRouter, SlotRouter, IngameRouter, BagRouter, PokeboxRouter, TicketRouter, SafariRouter };
