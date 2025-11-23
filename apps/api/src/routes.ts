import { Router } from 'express';
import { Controllers } from './controllers';
import { Authenticate } from './middlewares/authenicate.middleware';
import { AuthenticateForAccountRestore } from './middlewares/autologin-authenicate.middleware';

//Account
const AccountRouter = Router();
AccountRouter.post('/register', Controllers.Account.registerLocal);
AccountRouter.post('/login/local', Controllers.Account.loginLocal);
AccountRouter.get('/auth/refresh', Controllers.Account.checkRefreshToken);
AccountRouter.get('/login/auto', Authenticate, Controllers.Account.autoLogin);
AccountRouter.get('/logout', Controllers.Account.logout);
AccountRouter.get('/delete', Authenticate, Controllers.Account.deleteAccount);
AccountRouter.get('/delete/restore', AuthenticateForAccountRestore, Controllers.Account.deleteRestoreAccount);

//Ingame
const IngameRouter = Router();
IngameRouter.get('/get', Authenticate, Controllers.Ingame.getIngame);
IngameRouter.post('/register', Authenticate, Controllers.Ingame.registerIngame);
IngameRouter.get('/ticket/get', Authenticate, Controllers.Ingame.getAvailableTicket);
IngameRouter.get('/ticket/receive', Authenticate, Controllers.Ingame.receiveAvailableTicket);

//Bag
const BagRouter = Router();
BagRouter.post('/add', Authenticate, Controllers.Bag.addIngameItem);
BagRouter.get('/get', Authenticate, Controllers.Bag.getIngameItems);
BagRouter.post('/buy', Authenticate, Controllers.Bag.buyIngameItem);
BagRouter.post('/ticket/use', Authenticate, Controllers.Bag.useSafariTicket);

//PC
const PcRouter = Router();
PcRouter.post('/add', Authenticate, Controllers.PC.addPcPokemon);
PcRouter.post('/get', Authenticate, Controllers.PC.getPc);
PcRouter.post('/move', Authenticate, Controllers.PC.movePc);
PcRouter.post('/evol', Authenticate, Controllers.PC.evolvePc);

//safari
const SafariRouter = Router();
SafariRouter.post('/enter', Authenticate, Controllers.Safari.enterSafariZone);
SafariRouter.get('/exit', Authenticate, Controllers.Safari.exitSafariZone);
SafariRouter.post('/catch/wild', Authenticate, Controllers.Safari.catchWild);
SafariRouter.post('/catch/grounditem', Authenticate, Controllers.Safari.catchGroundItem);
SafariRouter.post('/catch/starter', Authenticate, Controllers.Safari.catchStarterPokemon);
SafariRouter.post('/feed/wild', Authenticate, Controllers.Safari.feedWildEatenBerry);

export default { AccountRouter, IngameRouter, BagRouter, PcRouter, SafariRouter };
