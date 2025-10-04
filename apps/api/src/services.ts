import bcrypt from 'bcrypt';
import { Repo } from './utils/repo';
import { EntityManager } from 'typeorm';
import {
  DuplicateAccountHttpError,
  DuplicateUserNicknameHttpError,
  IngameItemStockLimitExceeded,
  IngamePcIsFull,
  InvalidRefreshTokenHttpError,
  LoginFailHttpError,
  NoMoreEvolve,
  NotEnoughCandy,
  NotFoundAccountHttpError,
  NotFoundIngame,
  NotFoundIngameItem,
  NotFoundIngameItemType,
  NotFoundIngamePc,
  NotFoundPokemonData,
  NotFoundSafariTicket,
  NotPurchasableIngameItem,
} from './utils/http-error';
import { Ingame } from './entities/Ingame';
import { AppDataSource, redis } from './data-source';
import { Bag } from './entities/Bag';
import { getItemData, getOverworldData, getPokemonData } from './shared/data';
import { createTokens, gameSuccess, getGenderEnum, getGroundItems, getNextPcBoxNum, getWildPokemons, getWildSpawnTable } from './utils/methods';
import { Account } from './entities/Account';
import { AccountLocal } from './entities/AccountLocal';
import { verifyRefreshToken } from './utils/jwt';
import { PC } from './entities/PC';
import { IngameOption } from './entities/IngameOption';
import { AddItemReq, AddPcReq, BuyItemReq, EnterSafariZoneReq, EvolvePcReq, GetPcReq, LoginLocalReq, MovePcReq, RegisterIngameReq, RegisterLocalReq, UseItemReq } from './shared/interfaces';
import { EVOLVE_BONUS_CNT, MAX_BUY, MAX_GROUNDITEM, MAX_PER_BOX, MAX_STOCK, SaltOrRounds } from './shared/constants';
import { OverworldType, PokemonSkill } from './shared/enums';
import { LastWild } from './entities/LastWild';
import { LastGroundItem } from './entities/LastGroundItem';
import { GroundItem, Wild } from './shared/types';

export const registerLocal = async (data: RegisterLocalReq) => {
  const { username, password, email } = data;
  const hashedPassword = await bcrypt.hash(password, SaltOrRounds);

  return AppDataSource.manager.transaction(async (manager) => {
    const accountLocalRepo = manager.getRepository(AccountLocal);
    const existingUser = await accountLocalRepo.findOne({ where: { username } });

    if (existingUser) {
      throw new DuplicateAccountHttpError();
    }

    const newAccount = manager.create(Account);
    await manager.save(newAccount);

    const newAccountLocal = manager.create(AccountLocal, {
      account_id: newAccount.id,
      username,
      password: hashedPassword,
      email,
    });
    await manager.save(newAccountLocal);

    return newAccount;
  });
};

export const loginLocal = async (data: LoginLocalReq) => {
  const accountLocalRepo = Repo.accountLocal;
  const localAccount = await accountLocalRepo.findOne({
    where: { username: data.username },
    relations: ['account'],
  });

  if (!localAccount) {
    throw new LoginFailHttpError();
  }

  const isPasswordMatch = await bcrypt.compare(data.password, localAccount.password);
  if (isPasswordMatch) {
    return localAccount.account;
  }

  return null;
};

export const autoLogin = async () => {
  return gameSuccess(true);
};

export const checkRefreshToken = async (refresh: string) => {
  const payload = verifyRefreshToken(refresh) as { id: number };
  const accountId = payload.id;
  const redisRefresh = await redis.get(`refresh:${accountId}`);

  if (refresh !== redisRefresh) throw new InvalidRefreshTokenHttpError();

  const newAccessToken = createTokens(accountId, 'access');
  return newAccessToken;
};

export const deleteAccount = async (account: Account) => {
  const accountRepo = Repo.account;
  const updateResult = await accountRepo.update({ id: account.id }, { isDelete: true });

  if (updateResult.affected === 0) throw new NotFoundAccountHttpError();

  return gameSuccess(null);
};

export const deleteRestoreAccount = async (account: Account) => {
  const accountRepo = Repo.account;
  const updateResult = await accountRepo.update({ id: account.id }, { isDelete: false });

  if (updateResult.affected === 0) throw new NotFoundAccountHttpError();

  return gameSuccess(null);
};

export const getIngame = async (account: Account) => {
  let ret;

  await AppDataSource.manager.transaction(async (manager) => {
    const ingame = await manager.findOne(Ingame, { where: { account: { id: account.id } } });
    let pet = null;
    let party = [];
    let slot_item = [];

    if (!ingame) throw new NotFoundIngame();

    if (ingame.pet) pet = await manager.findOne(PC, { where: { account: { id: account.id }, idx: ingame.pet } });

    const currentParty = ingame.party;
    for (let i = 0; i < 6; i++) {
      if (currentParty[i]) {
        const target = await manager.findOne(PC, { where: { account: { id: account.id }, idx: currentParty[i] } });
        party.push(target);
      } else {
        party.push(null);
      }
    }

    const currentItemSlot = ingame.slotItem;
    for (let i = 0; i < 9; i++) {
      if (currentItemSlot[i]) {
        const target = await manager.findOne(Bag, { where: { account: { id: account.id }, idx: currentItemSlot[i] } });
        slot_item.push(target);
      } else {
        slot_item.push(null);
      }
    }

    const option = await manager.findOne(IngameOption, { where: { account: { id: account.id } } });
    const bag = await manager.find(Bag, { where: { account: { id: account.id } } });

    ret = {
      location: ingame.location,
      nickname: ingame.nickname,
      gender: ingame.gender,
      avatar: ingame.avatar,
      party: party,
      slotItem: slot_item,
      pet: pet,
      createdAt: ingame.createdAt,
      updatedAt: ingame.updatedAt,
      pcBg: ingame.pcBg,
      pcName: ingame.pcName,
      isStarter: ingame.isStarter,
      isTutorial: ingame.isTutorial,
      candy: ingame.candy,
      x: ingame.x,
      y: ingame.y,
      option: option,
      bag: bag,
    };
  });

  return ret;
};

export const registerIngame = async (data: RegisterIngameReq, account: Account) => {
  let ret;
  await AppDataSource.manager.transaction(async (manager) => {
    const ingameRepo = manager.getRepository(Ingame);
    const optionRepo = manager.getRepository(IngameOption);

    const existingNickname = await ingameRepo.findOneBy({ nickname: data.nickname });
    if (existingNickname) {
      throw new DuplicateUserNicknameHttpError();
    }

    const newIngame = ingameRepo.create({
      account: account,
      nickname: data.nickname,
      x: 44,
      y: 53,
      location: '001',
      gender: getGenderEnum(data.gender),
      avatar: data.avatar,
      candy: 0,
      pet: null,
    });
    await manager.save(newIngame);

    const newOption = optionRepo.create({
      account: account,
    });
    await manager.save(newOption);

    ret = {
      ...newIngame,
      option: newOption,
    };
  });

  return gameSuccess(ret);
};

export const addIngameItem = async (account: Account, item: AddItemReq, manager?: EntityManager): Promise<any> => {
  const bagRepo = manager ? manager.getRepository(Bag) : Repo.bag;
  const itemType = getItemData(item.item)?.type;

  if (!itemType) throw new NotFoundIngameItemType();
  if (item.stock <= 0 || item.stock > MAX_STOCK) throw new IngameItemStockLimitExceeded();

  const exist = await bagRepo.findOne({
    where: { account: { id: account.id }, item: item.item },
  });

  if (exist) {
    exist.stock += item.stock;

    if (exist.stock > MAX_STOCK) throw new IngameItemStockLimitExceeded();

    await bagRepo.save(exist);

    return manager ? exist : gameSuccess(exist);
  } else {
    const newIngameItem = bagRepo.create({
      account: { id: account.id },
      item: item.item,
      category: itemType,
      stock: item.stock,
    });

    await bagRepo.save(newIngameItem);

    return manager ? newIngameItem : gameSuccess(newIngameItem);
  }
};

export const getIngameItems = async (account: Account, manager?: EntityManager): Promise<any> => {
  const bagRepo = manager ? manager.getRepository(Bag) : Repo.bag;
  const bag = await bagRepo.find({ where: { account: { id: account.id } } });
  const ret = bag
    .map((item) => ({
      item: item.item,
      category: item.category,
      stock: item.stock,
    }))
    .sort((a, b) => a.item.localeCompare(b.item));

  if (manager) return ret;

  return gameSuccess(ret);
};

export const buyItem = async (account: Account, data: BuyItemReq): Promise<any> => {
  let ret;

  await AppDataSource.manager.transaction(async (manager) => {
    const itemData = getItemData(data.item);

    if (!itemData) throw new NotFoundIngameItem();
    if (!itemData.purchasable) throw new NotPurchasableIngameItem();
    if (data.stock <= 0 || data.stock > MAX_BUY) throw new IngameItemStockLimitExceeded();

    const ingame = await manager.findOne(Ingame, { where: { account: { id: account.id } } });
    if (!ingame) throw new NotFoundIngame();

    const cost = data.stock * itemData.price;

    if (cost > ingame.candy) throw new NotEnoughCandy();

    const newCandy = ingame.candy - cost;
    await manager.update(Ingame, { account: { id: account.id } }, { candy: newCandy });
    const resultItem = await addIngameItem(account, { item: data.item, stock: data.stock }, manager);

    ret = {
      idx: resultItem.idx,
      item: resultItem.item,
      category: resultItem.category,
      stock: resultItem.stock,
      candy: newCandy,
    };
  });

  return ret;
};

export const addPcPokemon = async (account: Account, pokemon: AddPcReq, manager?: EntityManager): Promise<any> => {
  const pcRepo = manager ? manager.getRepository(PC) : Repo.pc;
  const ingameRepo = manager ? manager.getRepository(Ingame) : Repo.ingame;

  const ingame = await ingameRepo.findOneBy({
    account: { id: account.id },
  });

  const pc = await pcRepo.findOneBy({
    account: { id: account.id },
    pokedex: pokemon.pokedex,
    gender: pokemon.gender,
  });

  if (!ingame) throw new NotFoundIngame();

  if (pc) {
    const currentSkills = pc.skill;
    const hasSkill = pokemon.skill !== PokemonSkill.NONE && !currentSkills.includes(pokemon.skill);
    const newSkills = hasSkill ? [...currentSkills, pokemon.skill] : currentSkills;

    await pcRepo.update(
      { account: { id: account.id }, pokedex: pokemon.pokedex, gender: pokemon.gender },
      {
        shiny: pokemon.shiny,
        form: pokemon.form,
        count: pc.count + 1,
        skill: newSkills,
        updatedBall: pokemon.capture_ball,
        updatedLocation: pokemon.location,
      },
    );
  } else {
    const nextBoxNum = getNextPcBoxNum(ingame.pcCnt) as [number, number];

    const newPokemon = pcRepo.create({
      account: { id: account.id },
      pokedex: pokemon.pokedex,
      gender: pokemon.gender,
      shiny: pokemon.shiny,
      form: pokemon.form,
      skill: [pokemon.skill],
      box: nextBoxNum[0],
      createdBall: pokemon.capture_ball,
      createdLocation: pokemon.location,
    });

    await updatePcBoxNum(account.id, nextBoxNum[0], nextBoxNum[1] + 1, manager!);
    await pcRepo.save(newPokemon);

    return gameSuccess(newPokemon);
  }
};

export const getPc = async (account: Account, filter: GetPcReq, manager?: EntityManager) => {
  const pcRepo = manager ? manager.getRepository(PC) : Repo.pc;
  const pc = await pcRepo.find({
    where: {
      account: { id: account.id },
      box: filter.box,
    },
    order: {
      updatedAt: 'ASC',
    },
  });

  if (!pc) return gameSuccess([]);

  const ret = pc.map((data) => {
    const pokemonData = getPokemonData(data.pokedex);
    const rank = pokemonData.rank;
    const evol = pokemonData.nextEvol;
    const type1 = pokemonData.type1;
    const type2 = pokemonData.type2;

    return {
      idx: data.idx,
      pokedex: data.pokedex,
      gender: data.gender,
      shiny: data.shiny,
      form: data.form,
      count: data.count,
      skill: data.skill,
      nickname: data.nickname,
      createdLocation: data.createdLocation,
      createdAt: data.createdAt,
      createdBall: data.createdBall,
      rank: rank,
      evol: evol,
      type_1: type1,
      type_2: type2,
    };
  });

  return gameSuccess(ret);
};

export const updatePcBoxNum = async (account_id: number, cntIdx: number, value: number, manager: EntityManager) => {
  const ingameRepo = manager ? manager.getRepository(Ingame) : Repo.ingame;

  await ingameRepo.query(`UPDATE db.ingame SET pc_cnt[$1] = $2 WHERE account_id = $3`, [cntIdx + 1, value, account_id]);
};

export const movePc = async (account: Account, data: MovePcReq): Promise<any> => {
  let ret;

  await AppDataSource.manager.transaction(async (manager) => {
    const ingame = await manager.findOne(Ingame, { where: { account: { id: account.id } } });
    const pokemon = await manager.findOne(PC, {
      where: { account: { id: account.id }, idx: data.target },
    });

    if (!ingame) throw new NotFoundIngame();
    if (!pokemon) throw new NotFoundIngamePc();

    const fromPcCnt = ingame?.pcCnt[data.from];
    const toPcCnt = ingame?.pcCnt[data.to];

    if (toPcCnt && toPcCnt >= MAX_PER_BOX) throw new IngamePcIsFull();

    await updatePcBoxNum(account.id, data.from, fromPcCnt - 1, manager);
    await updatePcBoxNum(account.id, data.to, toPcCnt + 1, manager);
    await manager.update(PC, { idx: data.target }, { box: data.to });

    ret = await getPc(account, { box: data.from }, manager);
  });

  return ret;
};

export const evolvePc = async (account: Account, data: EvolvePcReq): Promise<any> => {
  let ret;

  await AppDataSource.manager.transaction(async (manager) => {
    const ingame = await manager.findOne(Ingame, { where: { account: { id: account.id } } });
    const pokemon = await manager.findOne(PC, {
      where: { account: { id: account.id }, idx: data.target },
    });

    if (!ingame) throw new NotFoundIngame();
    if (!pokemon) throw new NotFoundIngamePc();

    const pokemonData = getPokemonData(pokemon.pokedex);

    if (!pokemonData) throw new NotFoundPokemonData();
    if (!pokemonData.nextEvol.next) throw new NoMoreEvolve();
    if (typeof pokemonData.nextEvol.cost === 'number' && ingame.candy < pokemonData.nextEvol.cost) throw new NotEnoughCandy();
    if (typeof pokemonData.nextEvol.cost === 'number') {
      ingame.candy -= pokemonData.nextEvol.cost;
      await manager.update(Ingame, { account: { id: account.id } }, { candy: ingame.candy });
    }

    const existPokemon = await manager.findOne(PC, {
      where: { account: { id: account.id }, pokedex: pokemonData.nextEvol.next, gender: pokemon.gender },
    });

    if (existPokemon) {
      const newExistPokemonCnt = existPokemon.count + pokemon.count;
      await manager.update(PC, { idx: existPokemon.idx }, { count: newExistPokemonCnt + EVOLVE_BONUS_CNT });
      await manager.delete(PC, { idx: pokemon.idx });
      await updatePcBoxNum(account.id, pokemon.box, ingame.pcCnt[pokemon.box] - 1, manager);
    } else {
      await manager.update(PC, { idx: pokemon.idx }, { pokedex: pokemonData.nextEvol.next, count: pokemon.count + EVOLVE_BONUS_CNT });
    }

    ret = await getPc(account, { box: pokemon.box }, manager);
  });

  return ret;
};

export const getAvailableTicket = async (account: Account, manager?: EntityManager) => {
  const ingameRepo = manager ? manager.getRepository(Ingame) : Repo.ingame;

  const ingame = await ingameRepo.findOneBy({
    account: { id: account.id },
  });

  if (!ingame) throw new NotFoundIngame();

  return manager ? ingame.availableTicket : gameSuccess(ingame.availableTicket);
};

export const receiveAvailableTicket = async (account: Account, manager?: EntityManager) => {
  let ret = null;
  await AppDataSource.manager.transaction(async (manager) => {
    const ticket = (await getAvailableTicket(account, manager)) as number;

    if (ticket <= 0) throw new NotFoundSafariTicket();

    await manager.update(Ingame, { account: { id: account.id } }, { availableTicket: 0 });
    ret = await addIngameItem(account, { item: '030', stock: ticket }, manager);
  });

  return gameSuccess(ret);
};

export const useItem = async (account: Account, data: UseItemReq, manager?: EntityManager) => {
  const bagRepo = manager ? manager.getRepository(Bag) : Repo.bag;
  const bag = await bagRepo.findOne({ where: { account: { id: account.id }, item: data.item } });
  let ret;

  if (!bag) throw new NotFoundIngameItem();
  if (bag.stock < bag.stock - data.cost) throw new IngameItemStockLimitExceeded();

  const newStock = bag.stock - data.cost;
  await bagRepo.update({ account: { id: account.id }, item: data.item }, { stock: newStock });

  ret = {
    item: bag.item,
    category: bag.category,
    stock: newStock,
  };

  if (newStock <= 0) await bagRepo.delete({ account: { id: account.id }, item: data.item });

  return ret;
};

export const useSafariTicket = async (account: Account, data: UseItemReq) => {
  let ret = null;
  await AppDataSource.manager.transaction(async (manager) => {
    ret = await useItem(account, { item: '030', cost: data.cost }, manager);
  });

  return gameSuccess(ret);
};

export const enterSafariZone = async (account: Account, data: EnterSafariZoneReq) => {
  const overworldData = getOverworldData(data.overworld);
  let result = {
    wilds: [] as Wild[],
    groundItems: [] as GroundItem[],
  };

  if (overworldData.type === OverworldType.PLAZA) return gameSuccess(null);

  await AppDataSource.manager.transaction(async (manager) => {
    const existWilds = await manager.find(LastWild, { where: { account: { id: account.id }, location: data.overworld } });
    const existGroundItems = await manager.find(LastGroundItem, { where: { account: { id: account.id }, location: data.overworld } });

    if (existWilds.length > 0 || existGroundItems.length > 0) {
      result.wilds = existWilds.map((pokemon) => {
        const pokemonData = getPokemonData(pokemon.pokedex);
        const baseRate = pokemonData.rate.capture;
        const rank = pokemonData.rank;
        const type1 = pokemonData.type1;
        const type2 = pokemonData.type2;

        return {
          idx: pokemon.idx,
          pokedex: pokemon.pokedex,
          gender: pokemon.gender,
          shiny: pokemon.shiny,
          skills: pokemon.skill,
          form: pokemon.form,
          catch: pokemon.capture,
          eaten_berry: pokemon.eatenBerry,
          baseRate: baseRate,
          type1: type1,
          type2: type2,
          rank: rank,
          spawn: pokemon.spawnType,
        } as Wild;
      });

      result.groundItems = existGroundItems.map(
        (item) =>
          ({
            idx: item.idx,
            item: item.item,
            stock: item.stock,
            catch: item.capture,
          } as GroundItem),
      );
      return;
    }

    const pokedexs = getWildSpawnTable(overworldData.spawn, overworldData.spawnCount);
    const groundItems = getGroundItems(Math.floor(Math.random() * MAX_GROUNDITEM));
    const newWilds = getWildPokemons(pokedexs);

    const wildEntities = newWilds.map((pokemon) =>
      manager.create(LastWild, {
        account: { id: account.id },
        location: data.overworld,
        pokedex: pokemon.pokedex,
        gender: pokemon.gender,
        shiny: pokemon.shiny,
        form: pokemon.form,
        skill: Array.isArray(pokemon.skills) ? pokemon.skills : [pokemon.skills],
        capture: false,
        spawnType: pokemon.spawn,
        eatenBerry: pokemon.eaten_berry,
      }),
    );
    await manager.save(wildEntities);

    const groundItemEntities = groundItems.map((item) =>
      manager.create(LastGroundItem, {
        account: { id: account.id },
        location: data.overworld,
        item: item.item,
        stock: item.stock,
        capture: false,
      }),
    );
    await manager.save(groundItemEntities);

    const retWilds = await manager.find(LastWild, {
      where: { account: { id: account.id }, location: data.overworld },
    });
    const retGroundItems = await manager.find(LastGroundItem, {
      where: { account: { id: account.id }, location: data.overworld },
    });

    result.wilds = retWilds.map((pokemon) => {
      const pokemonData = getPokemonData(pokemon.pokedex);
      const baseRate = pokemonData.rate.capture;
      const rank = pokemonData.rank;
      const type1 = pokemonData.type1;
      const type2 = pokemonData.type2;

      return {
        idx: pokemon.idx,
        pokedex: pokemon.pokedex,
        gender: pokemon.gender,
        shiny: pokemon.shiny,
        skills: pokemon.skill,
        form: pokemon.form,
        catch: pokemon.capture,
        eaten_berry: pokemon.eatenBerry,
        baseRate: baseRate,
        type1: type1,
        type2: type2,
        rank: rank,
        spawn: pokemon.spawnType,
      } as Wild;
    });

    result.groundItems = retGroundItems.map(
      (item) =>
        ({
          idx: item.idx,
          item: item.item,
          stock: item.stock,
          catch: item.capture,
        } as GroundItem),
    );
  });

  return gameSuccess(result);
};

// export const updateItemSlot = async (ingame: Ingame, itemSlot: SlotReq) => {
//   const ingameRepo = Repo.ingame;

//   await ingameRepo.update(ingame.account_id, {
//     itemslot: itemSlot.data,
//   });

//   return gameSuccess(null);
// };

// export const updateParty = async (ingame: Ingame, party: PartyReq) => {
//   const ingameRepo = Repo.ingame;

//   await ingameRepo.update(ingame.account_id, {
//     party: party.data,
//   });

//   return gameSuccess(null);
// };

// export const updatePokeboxBg = async (ingame: Ingame, backgrounds: BoxBgReq) => {
//   const ingameRepo = Repo.ingame;

//   await ingameRepo.update(ingame.account_id, {
//     boxes: backgrounds.data,
//   });

//   return gameSuccess(null);
// };

// export const getAvailableTicket = async (ingame: Ingame) => {
//   return gameSuccess(ingame.available_ticket);
// };

// export const receiveAvailableTicket = async (ingame: Ingame) => {
//   await AppDataSource.manager.transaction(async (manager) => {
//     const ticket = ingame.available_ticket;

//     await manager.update(Ingame, { account_id: ingame.account_id }, { available_ticket: 0 });
//     await addItem(ingame, { item: '030', stock: ticket }, manager);
//   });
//   return gameSuccess(null);
// };

// export const addItem = async (ingame: Ingame, item: ItemReq, manager?: EntityManager): Promise<any> => {
//   const bagRepo = manager ? manager.getRepository(Bag) : Repo.bag;
//   const itemType = getItemData(item.item)?.type;

//   if (!itemType) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);
//   if (item.stock <= 0 || item.stock > MAX_STOCK) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);

//   const exist = await bagRepo.findOne({
//     where: { account_id: ingame.account_id, item: item.item },
//   });

//   if (exist) {
//     exist.stock += item.stock;

//     if (exist.stock > MAX_STOCK) return gameFail(GameLogicErrorCode.MAX_STOCK);

//     await bagRepo.save(exist);

//     return gameSuccess(exist);
//   } else {
//     const newItem = bagRepo.create({
//       account_id: ingame.account_id,
//       item: item.item,
//       category: itemType,
//       stock: item.stock,
//     });

//     await bagRepo.save(newItem);

//     return gameSuccess(newItem);
//   }
// };

// export const buyItem = async (ingame: Ingame, item: ItemReq) => {
//   let ret;
//   await AppDataSource.manager.transaction(async (manager) => {
//     const itemData = getItemData(item.item);

//     if (!itemData) {
//       ret = gameFail(GameLogicErrorCode.NOT_FOUND_DATA);
//       return;
//     }
//     if (!itemData.purchasable) {
//       ret = gameFail(GameLogicErrorCode.NOT_PURCHASABEE_ITEM);
//       return;
//     }
//     if (item.stock <= 0 || item.stock > MAX_BUY) {
//       ret = gameFail(GameLogicErrorCode.WRONG_REQUEST_STOCK);
//       return;
//     }

//     const bag = await manager.findOne(Bag, { where: { account_id: ingame.account_id, item: item.item } });
//     const cost = item.stock * itemData.price;
//     let result: ItemReq;

//     if (cost > ingame.money) {
//       ret = gameFail(GameLogicErrorCode.NOT_ENOUGH_CANDY);
//       return;
//     }

//     ingame.money -= cost;

//     if (bag) {
//       const newStock = bag.stock + item.stock;
//       if (newStock > MAX_STOCK) {
//         ret = gameFail(GameLogicErrorCode.MAX_STOCK);
//         return;
//       }

//       bag.stock = newStock;
//       await manager.save(bag);
//       result = bag;
//     } else {
//       result = await addItem(ingame, item, manager);
//     }
//     await manager.save(ingame);

//     ret = gameSuccess({
//       candy: ingame.money,
//       item: result.item,
//       category: itemData.type,
//       stock: result.stock,
//     });
//   });

//   return ret;
// };

// export const useItem = async (ingame: Ingame, item: ItemReq, manager?: EntityManager): Promise<any> => {
//   const bagRepo = manager ? manager.getRepository(Bag) : Repo.bag;
//   const bag = await bagRepo.findOne({ where: { account_id: ingame.account_id, item: item.item } });

//   if (!bag) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);
//   if (bag.stock < item.stock) return gameFail(GameLogicErrorCode.NOT_ENOUGH_STOCK);
//   if (item.stock <= 0) return gameFail(GameLogicErrorCode.WRONG_REQUEST_STOCK);
//   if (bag.stock - item.stock <= 0) {
//     return gameSuccess(await bagRepo.delete(bag));
//   }

//   bag.stock -= item.stock;

//   await bagRepo.save(bag);

//   return gameSuccess(bag);
// };

// export const getItemByCategory = async (ingame: Ingame, item: ItemCategoryReq): Promise<any> => {
//   const bagRepo = Repo.bag;
//   const bag = await bagRepo.find({
//     where: { account_id: ingame.account_id, category: item.category },
//   });
//   const ret = bag
//     .map((item) => ({
//       item: item.item,
//       stock: item.stock,
//     }))
//     .sort((a, b) => a.item.localeCompare(b.item));

//   return gameSuccess(ret);
// };

// export const addPokemon = async (ingame: Ingame, pokemon: MyPokemonReq, manager?: EntityManager) => {
//   const pokeboxRepo = manager ? manager.getRepository(Pokebox) : Repo.pokebox;
//   const pokebox = await pokeboxRepo.findOneBy({
//     account_id: ingame.account_id,
//     pokedex: pokemon.pokedex,
//     gender: pokemon.gender,
//   });

//   if (pokebox) {
//     // console.log('1. pokemon.skill : ', pokemon.skill);
//     // console.log('2. pokemon.skill !== PokemonSkill.NONE : ', pokemon.skill !== PokemonSkill.NONE);

//     const currentSkills = pokebox.skill || [];
//     const hasSkill = pokemon.skill !== PokemonSkill.NONE && !currentSkills.includes(pokemon.skill);
//     const newSkill = hasSkill ? [...currentSkills, pokemon.skill] : currentSkills;

//     // console.log('3. newSkill : ', newSkill);

//     await pokeboxRepo.update(
//       { account_id: ingame.account_id, pokedex: pokemon.pokedex, gender: pokemon.gender },
//       {
//         shiny: pokebox.shiny ? true : pokemon.shiny,
//         form: pokemon.form,
//         count: pokebox.count + 1,
//         skill: newSkill,
//         capture_location: pokemon.location,
//         capture_ball: pokemon.capture_ball,
//       },
//     );
//   } else {
//     const nextPokebox = getNextPokeboxIndex(ingame.boxes_cnt);

//     console.log(nextPokebox);

//     await AppDataSource.manager.transaction(async (manager) => {
//       const newPokemon = pokeboxRepo.create({
//         account_id: ingame.account_id,
//         pokedex: pokemon.pokedex,
//         gender: pokemon.gender,
//         shiny: pokemon.shiny,
//         form: pokemon.form,
//         skill: pokemon.skill === 'none' ? [] : [pokemon.skill],
//         box: nextPokebox[0],
//         capture_location: pokemon.location,
//         capture_ball: pokemon.capture_ball,
//       });

//       await updatePokeboxCnt(ingame.account_id, nextPokebox[0], nextPokebox[1] + 1, manager);
//       await pokeboxRepo.save(newPokemon);
//     });
//   }

//   return gameSuccess(null);
// };

// export const updatePokeboxCnt = async (account_id: number, idx: number, value: number, manager?: EntityManager) => {
//   const ingameRepo = manager ? manager.getRepository(Ingame) : Repo.ingame;

//   await ingameRepo.query(`UPDATE db0.ingame SET boxes_cnt[$1] = $2 WHERE account_id = $3`, [idx + 1, value, account_id]);
// };

// export const getPokebox = async (ingame: Ingame, search: PokeboxSelectReq, manager?: EntityManager) => {
//   const pokeboxRepo = manager ? manager.getRepository(Pokebox) : Repo.pokebox;
//   const pokebox = await pokeboxRepo.find({
//     where: {
//       account_id: ingame.account_id,
//       box: search.box,
//     },
//     order: {
//       update_date: 'ASC',
//     },
//   });

//   if (!pokebox) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);

//   const ret = pokebox.map((data) => {
//     const pokemonData = getPokemonData(data.pokedex);

//     const rank = pokemonData.rank;
//     const evol = pokemonData.nextEvol;

//     return {
//       idx: data.idx,
//       pokedex: data.pokedex,
//       gender: data.gender,
//       shiny: data.shiny,
//       form: data.form,
//       count: data.count,
//       skill: data.skill,
//       captureDate: data.capture_date,
//       captureBall: data.capture_ball,
//       captureLocation: data.capture_location,
//       nickname: data.nickname,
//       rank: rank,
//       evol: evol,
//     };
//   });

//   return gameSuccess(ret);
// };

// export const movePokemon = async (ingame: Ingame, info: MovePokemonReq) => {
//   let ret;

//   await AppDataSource.manager.transaction(async (manager) => {
//     const pokeboxRepo = Repo.pokebox;
//     const pokemon = pokeboxRepo.findOneBy({
//       account_id: ingame.account_id,
//       pokedex: info.pokedex,
//       gender: info.gender as PokemonGender,
//     });

//     if (!pokemon) {
//       ret = gameFail(GameLogicErrorCode.NOT_FOUND_DATA);
//       return;
//     }
//     if (ingame.boxes_cnt[info.to] >= MAX_PER_BOX) {
//       ret = gameFail(GameLogicErrorCode.FULL_BOX);
//       return;
//     }

//     await updatePokeboxCnt(ingame.account_id, info.from, ingame.boxes_cnt[info.from] - 1, manager);
//     await updatePokeboxCnt(ingame.account_id, info.to, ingame.boxes_cnt[info.to] + 1, manager);
//     await pokeboxRepo.update(
//       { account_id: ingame.account_id, pokedex: info.pokedex, gender: info.gender },
//       {
//         box: info.to,
//       },
//     );

//     ret = gameSuccess(await getPokebox(ingame, { box: info.from }, manager));
//   });

//   return ret;
// };

// export const useTicket = async (ingame: Ingame, data: UseTicketReq) => {
//   const bagRepo = Repo.bag;
//   const overworld = getOverworldData(data.overworld);
//   const bag = await bagRepo.findOne({
//     where: { account_id: ingame.account_id, item: '030' },
//   });

//   if (!bag) return gameFail(GameLogicErrorCode.NOT_ENOUGH_TICKET);

//   const newStock = bag.stock - overworld.cost;

//   if (newStock < 0) {
//     return gameFail(GameLogicErrorCode.NOT_ENOUGH_TICKET);
//   } else {
//     bag.stock = newStock;
//     await useItem(ingame, { item: '030', stock: overworld.cost });
//   }

//   return gameSuccess({
//     item: '030',
//     category: ItemType.ETC,
//     stock: bag.stock,
//   });
// };

// export const moveToOverworld = async (ingame: Ingame, data: MoveToOverworldReq, wrapResult: boolean = true) => {
//   const overworld = getOverworldData(data.overworld);
//   let posX = data.x ? data.x : ingame.x;
//   let posY = data.y ? data.y : ingame.y;

//   let result: { pokemons: WildPokemon[]; items: GroundItem[]; overworld: string; entryX: number; entryY: number } = {
//     pokemons: [],
//     items: [],
//     overworld: data.overworld,
//     entryX: posX,
//     entryY: posY,
//   };

//   await AppDataSource.manager.transaction(async (manager) => {
//     if (overworld.type === OverworldType.SAFARI) {
//       const existWild = await manager.find(Wild, {
//         where: { account_id: ingame.account_id, overworld: data.overworld },
//       });

//       if (existWild.length > 0) {
//         const existGroundItems = await manager.find(Grounditem, {
//           where: { account_id: ingame.account_id, overworld: data.overworld },
//         });

//         result.pokemons = existWild.map((pokemon) => {
//           const pokemonData = getPokemonData(pokemon.pokedex);
//           const baseRate = pokemonData.rate.capture;
//           const rank = pokemonData.rank;

//           return {
//             idx: pokemon.idx,
//             pokedex: pokemon.pokedex,
//             gender: pokemon.gender,
//             shiny: pokemon.shiny,
//             skills: pokemon.skills,
//             form: pokemon.form,
//             catch: pokemon.catch,
//             eaten_berry: pokemon.eaten_berry,
//             baseRate: baseRate,
//             rank: rank,
//             spawns: getSpawnEnum(pokemon.spawns),
//           };
//         });

//         result.items = existGroundItems.map((item) => ({
//           idx: item.idx,
//           item: item.item,
//           stock: item.stock,
//           catch: item.catch,
//         }));

//         await manager.update(Ingame, { account_id: ingame.account_id }, { location: data.overworld, x: posX, y: posY });
//         return;
//       }

//       const pokedexs = getWildSpawnTable(overworld.spawn, overworld.spawnCount);
//       const groundItems = getGroundItems(Math.floor(Math.random() * MAX_GROUNDITEM));
//       const wildPokemons = getWildPokemons(pokedexs);

//       result.pokemons = wildPokemons;
//       result.items = groundItems;
//       result.entryX = posX;
//       result.entryY = posY;

//       const wildEntities = wildPokemons.map((pokemon) =>
//         manager.create(Wild, {
//           account_id: ingame.account_id,
//           overworld: data.overworld,
//           pokedex: pokemon.pokedex,
//           gender: pokemon.gender,
//           shiny: pokemon.shiny,
//           skills: pokemon.skills,
//           form: pokemon.form,
//           catch: false,
//           spawns: pokemon.spawns.toString(),
//         }),
//       );
//       await manager.save(wildEntities);

//       const grounditemEntities = groundItems.map((item) =>
//         manager.create(Grounditem, {
//           account_id: ingame.account_id,
//           overworld: data.overworld,
//           item: item.item,
//           stock: item.stock,
//           catch: false,
//         }),
//       );
//       await manager.save(grounditemEntities);

//       const wilds = await manager.find(Wild, {
//         where: { account_id: ingame.account_id, overworld: data.overworld },
//       });

//       result.pokemons = wilds.map((pokemon) => {
//         const pokemonData = getPokemonData(pokemon.pokedex);
//         const baseRate = pokemonData.rate.capture;
//         const rank = pokemonData.rank;

//         return {
//           idx: pokemon.idx,
//           pokedex: pokemon.pokedex,
//           gender: pokemon.gender,
//           shiny: pokemon.shiny,
//           skills: pokemon.skills,
//           form: pokemon.form,
//           catch: pokemon.catch,
//           eaten_berry: pokemon.eaten_berry,
//           baseRate: baseRate,
//           rank: rank,
//           spawns: getSpawnEnum(pokemon.spawns),
//         };
//       });

//       const grounditems = await manager.find(Grounditem, {
//         where: { account_id: ingame.account_id, overworld: data.overworld },
//       });
//       result.items = grounditems.map((item) => ({
//         idx: item.idx,
//         item: item.item,
//         stock: item.stock,
//         catch: item.catch,
//       }));
//     } else {
//       await manager.delete(Wild, { account_id: ingame.account_id });
//       await manager.delete(Grounditem, { account_id: ingame.account_id });
//     }

//     await manager.update(Ingame, { account_id: ingame.account_id }, { location: data.overworld, x: posX, y: posY });
//   });

//   if (wrapResult) {
//     return gameSuccess(result);
//   }

//   return result;
// };

// export const catchGroundItem = async (ingame: Ingame, data: CatchSafariObjectReq) => {
//   const repo = Repo.GrounditemSpawns;
//   const item = await repo.findOneBy({ idx: data.idx });
//   let ret;

//   if (!item) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);

//   await AppDataSource.manager.transaction(async (manager) => {
//     await manager.update(
//       Grounditem,
//       { account_id: ingame.account_id, idx: data.idx },
//       {
//         catch: true,
//       },
//     );

//     ret = await addItem(ingame, { item: item.item, stock: item.stock }, manager);
//   });

//   return gameSuccess(ret);
// };

// export const catchWildPokemon = async (ingame: Ingame, data: CatchPokemonReq) => {
//   const repo = Repo.WildSpawns;
//   const pokeboxRepo = Repo.pokebox;
//   const wild = await repo.findOneBy({ idx: data.idx });
//   const pokemonData = getPokemonData(wild!.pokedex);

//   let ret;

//   if (!wild) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);

//   await AppDataSource.manager.transaction(async (manager) => {
//     const baseRate = pokemonData.rate.capture;
//     const ballRate = getCatchItemData(data.ball).rate;
//     const berryRate = matchTypeWithBerryRate(data.berry, pokemonData.type1, pokemonData.type2);
//     const pokemonRank = getPokemonData(wild.pokedex).rank;

//     let partyScoreSum = 0;

//     for (const idx of data.parties) {
//       const myPokemon = await pokeboxRepo.findOneBy({ idx: idx });

//       if (!myPokemon) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);

//       const shinyRate = myPokemon.shiny ? 2.0 : 1.0;
//       const captureCntRate = myPokemon.count > 0 ? myPokemon.count * 0.01 : 0;
//       const rarityRate = matchPokemonWithRarityRate(getPokemonData(myPokemon.pokedex).rank);

//       const score = shinyRate * captureCntRate * rarityRate;
//       partyScoreSum += score;
//     }

//     const partyRate = partyScoreSum;
//     // const finalRate = Math.min(baseRate * ballRate * berryRate + partyRate, 0.95);
//     const finalRate = Math.min(baseRate * ballRate * berryRate + partyRate, 1.0);

//     console.log('finalRate: ' + finalRate);

//     if (data.berry) await useItem(ingame, { item: data.berry, stock: 1 }, manager);
//     await useItem(ingame, { item: data.ball, stock: 1 }, manager);

//     let result = Math.random() <= finalRate;

//     if (data.ball === '001') result = true;

//     if (result) {
//       //포획 성공
//       await addPokemon(ingame, { pokedex: wild.pokedex, gender: wild.gender, shiny: wild.shiny, form: wild.form, skill: wild.skills, location: wild.overworld, capture_ball: data.ball }, manager);
//       await manager.update(
//         Wild,
//         { idx: data.idx },
//         {
//           catch: true,
//         },
//       );

//       const candy = getRandomCandyReward(pokemonRank);
//       const rewards = getRandomRewards(pokemonRank);
//       ingame.money += candy;

//       for (const reward of rewards) {
//         await addItem(ingame, { item: reward.item, stock: reward.stock }, manager);
//       }

//       await manager.save(ingame);

//       ret = {
//         catch: true,
//         candy: candy,
//         reward: rewards,
//       };
//     } else {
//       //포획 실패
//       const fleeResult = Math.random() <= pokemonData.rate.flee;

//       if (data.berry) await manager.update(Wild, { idx: data.idx }, { eaten_berry: null });

//       if (fleeResult) {
//         await manager.update(Wild, { idx: data.idx }, { catch: true });
//         ret = {
//           catch: false,
//           flee: true,
//         };
//       } else {
//         ret = {
//           catch: false,
//           flee: false,
//         };
//       }
//     }
//   });

//   return gameSuccess(ret);
// };

// export const feedBerry = async (ingame: Ingame, data: FeedBerryReq, manager?: EntityManager) => {
//   let ret = null;
//   await AppDataSource.manager.transaction(async (manager) => {
//     const itemData = data.berry ? getItemData(data.berry) : null;
//     if (itemData) {
//       ret = await useItem(ingame, { item: data.berry!, stock: 1 }, manager);

//       if (ret.success) await manager.update(Wild, { idx: data.idx }, { eaten_berry: data.berry });
//       else return gameFail(ret);

//       ret = ret.data;

//       console.log(ret);
//     }
//   });

//   return gameSuccess(ret);
// };

// export const evolvePokemon = async (ingame: Ingame, data: EvolveReq) => {
//   let ret;

//   await AppDataSource.manager.transaction(async (manager) => {
//     const myPokemon = await manager.findOneBy(Pokebox, { account_id: ingame.account_id, idx: data.idx });
//     if (!myPokemon) {
//       ret = gameFail(GameLogicErrorCode.NOT_FOUND_DATA);
//       return;
//     }

//     const pokemonData = getPokemonData(myPokemon.pokedex);
//     if (!pokemonData) {
//       ret = gameFail(GameLogicErrorCode.NOT_FOUND_DATA);
//       return;
//     }
//     if (!pokemonData.nextEvol.next) {
//       ret = gameFail(GameLogicErrorCode.NO_EVOL);
//       return;
//     }
//     if (typeof pokemonData.nextEvol.cost === 'number' && ingame.money < pokemonData.nextEvol.cost) {
//       ret = gameFail(GameLogicErrorCode.NOT_ENOUGH_CANDY);
//       return;
//     }

//     if (typeof pokemonData.nextEvol.cost === 'number') {
//       ingame.money -= pokemonData.nextEvol.cost;
//       await manager.save(ingame);
//     }

//     const otherMyPokemon = await manager.findOneBy(Pokebox, { account_id: ingame.account_id, pokedex: pokemonData.nextEvol.next, gender: myPokemon.gender });
//     if (otherMyPokemon) {
//       const newOtherMyPokemonCount = myPokemon.count + otherMyPokemon.count;
//       await manager.update(Pokebox, { idx: otherMyPokemon.idx }, { count: newOtherMyPokemonCount + 1, shiny: otherMyPokemon.shiny || myPokemon.shiny });

//       await manager.delete(Pokebox, { idx: myPokemon.idx });
//       await updatePokeboxCnt(ingame.account_id, data.box, ingame.boxes_cnt[data.box] - 1, manager);
//     } else {
//       await manager.update(Pokebox, { idx: data.idx }, { pokedex: pokemonData.nextEvol.next, count: myPokemon.count + 1 });
//     }

//     const boxInfo = await getPokebox(ingame, { box: data.box }, manager);

//     if (boxInfo.result) ret = gameSuccess(boxInfo.data);
//     else ret = gameFail(GameLogicErrorCode.NOT_FOUND_DATA);
//   });

//   return ret;
// };

// export const enterToOverworld = async (ingame: Ingame, data: WarpReq) => {
//   const enterData = getEnterData(data.idx);
//   if (!enterData) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);

//   const result = await moveToOverworld(
//     ingame,
//     {
//       overworld: enterData.overworld,
//       x: enterData.x,
//       y: enterData.y,
//     },
//     false,
//   );

//   return gameSuccess(result);
// };

// export const exitToOverworld = async (ingame: Ingame, data: WarpReq) => {
//   const exitData = getExitData(data.idx);
//   if (!exitData) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);

//   const result = await moveToOverworld(
//     ingame,
//     {
//       overworld: exitData.overworld,
//       x: exitData.x,
//       y: exitData.y,
//     },
//     false,
//   );

//   return gameSuccess(result);
// };
