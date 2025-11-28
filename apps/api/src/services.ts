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
import { AppDataSource } from './data-source';
import { Bag } from './entities/Bag';
import { getCatchItemData, getItemData, getOverworldData, getPokemonData } from './shared/data';
import {
  createTokens,
  gameSuccess,
  generateDespawnTime,
  getGenderEnum,
  getGroundItemsFromCodes,
  getGroundItemSpawnTable,
  getNextPcBoxNum,
  getRandomCandyReward,
  getRandomRewards,
  getWildPokemons,
  getWildSpawnTable,
  matchTypeWithBerryRate,
} from './utils/methods';
import { Account } from './entities/Account';
import { AccountLocal } from './entities/AccountLocal';
import { verifyRefreshToken } from './utils/jwt';
import { PC } from './entities/PC';
import { IngameOption } from './entities/IngameOption';
import {
  AddItemReq,
  AddPcReq,
  BuyItemReq,
  CatchGroundItemReq,
  CatchStarterPokemonReq,
  CatchWildReq,
  EnterSafariZoneReq,
  EvolvePcReq,
  FeedWildEatenBerryReq,
  GetPcReq,
  LoginLocalReq,
  MovePcReq,
  RegisterIngameReq,
  RegisterLocalReq,
  UseItemReq,
} from './shared/interfaces';
import { EVOLVE_BONUS_CNT, MAX_BUY, MAX_PER_BOX, MAX_STOCK, SaltOrRounds, START_LOCATION, START_X, START_Y } from './shared/constants';
import { OverworldType, PokemonSkill, Rarity } from './shared/enums';
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
  try {
    const payload = verifyRefreshToken(refresh) as { id: number };
    const accountId = payload.id;
    const newAccessToken = createTokens(accountId, 'access');
    return newAccessToken;
  } catch (error) {
    throw new InvalidRefreshTokenHttpError();
  }
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
    let party = [];
    let slot_item = [];

    if (!ingame) throw new NotFoundIngame();

    const currentParty = ingame.party;
    for (let i = 0; i < 6; i++) {
      if (currentParty[i]) {
        const target = await manager.findOne(PC, { where: { account: { id: account.id }, idx: currentParty[i] } });
        if (target) {
          const pokemonData = getPokemonData(target.pokedex);
          const rank = pokemonData.rank;
          const evol = pokemonData.nextEvol;
          const type1 = pokemonData.type1;
          const type2 = pokemonData.type2;

          party.push({
            ...target,
            rank: rank,
            evol: evol,
            type_1: type1,
            type_2: type2,
          });
        } else {
          party.push(null);
        }
      } else {
        party.push(null);
      }
    }

    const currentItemSlot = ingame.slotItem;
    for (let i = 0; i < 5; i++) {
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
      createdAt: ingame.createdAt,
      updatedAt: ingame.updatedAt,
      pcBg: ingame.pcBg,
      pcName: ingame.pcName,
      isStarter0: ingame.isStarter0,
      isStarter1: ingame.isStarter1,
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
      x: START_X,
      y: START_Y,
      location: START_LOCATION,
      gender: getGenderEnum(data.gender),
      avatar: data.avatar,
      candy: 0,
    });
    await manager.save(newIngame);

    const newOption = optionRepo.create({
      account: account,
      textSpeed: data.option.textSpeed,
      frame: data.option.frame,
      backgroundVolume: data.option.backgroundVolume,
      effectVolume: data.option.effectVolume,
      tutorial: data.option.tutorial,
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
      idx: item.idx,
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
      createdAt: 'ASC',
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

export const getPcByIdx = async (account: Account, idx: number, manager?: EntityManager) => {
  let ret;
  await AppDataSource.manager.transaction(async (manager) => {
    const pc = await manager.findOne(PC, { where: { account: { id: account.id }, idx: idx } });
    if (!pc) throw new NotFoundIngamePc();

    const pokemonData = getPokemonData(pc.pokedex);
    const rank = pokemonData.rank;
    const evol = pokemonData.nextEvol;
    const type1 = pokemonData.type1;
    const type2 = pokemonData.type2;

    ret = {
      idx: pc.idx,
      pokedex: pc.pokedex,
      gender: pc.gender,
      shiny: pc.shiny,
      form: pc.form,
      count: pc.count,
      skill: pc.skill,
      nickname: pc.nickname,
      createdLocation: pc.createdLocation,
      createdAt: pc.createdAt,
      createdBall: pc.createdBall,
      rank: rank,
      evol: evol,
      type_1: type1,
      type_2: type2,
    };
  });
  return ret;
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
  const boxesToUpdate = new Set<number>();
  type BoxResult = { box: number; pokemons: any[] };
  let boxesResult: BoxResult[] = [];

  await AppDataSource.manager.transaction(async (manager) => {
    const ingame = await manager.findOne(Ingame, { where: { account: { id: account.id } } });
    const pokemon = await manager.findOne(PC, {
      where: { account: { id: account.id }, idx: data.target },
    });

    if (!ingame) throw new NotFoundIngame();
    if (!pokemon) throw new NotFoundIngamePc();

    boxesToUpdate.add(pokemon.box);

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
      boxesToUpdate.add(existPokemon.box);
      const newExistPokemonCnt = existPokemon.count + pokemon.count;
      await manager.update(PC, { idx: existPokemon.idx }, { count: newExistPokemonCnt + EVOLVE_BONUS_CNT });
      await manager.delete(PC, { idx: pokemon.idx });
      await updatePcBoxNum(account.id, pokemon.box, ingame.pcCnt[pokemon.box] - 1, manager);
    } else {
      await manager.update(PC, { idx: pokemon.idx }, { pokedex: pokemonData.nextEvol.next, count: pokemon.count + EVOLVE_BONUS_CNT });
    }

    const results: BoxResult[] = [];
    for (const box of boxesToUpdate) {
      const pcResult = await getPc(account, { box }, manager);
      results.push({
        box,
        pokemons: pcResult.data,
      });
    }
    boxesResult = results;
  });

  return gameSuccess(boxesResult);
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
    const now = new Date();
    const existWilds = await manager.find(LastWild, { where: { account: { id: account.id }, location: data.overworld } });
    const existGroundItems = await manager.find(LastGroundItem, { where: { account: { id: account.id }, location: data.overworld } });
    const wildsToUpdate: { idx: number; pokemon: ReturnType<typeof getWildPokemons>[0]; spawnTime: Date; despawnTime: Date }[] = [];

    if (existWilds.length > 0) {
      const pokedexs = getWildSpawnTable(data.overworld, overworldData.wild.spawn[data.time], overworldData.wild.count);
      const newWildsPool = getWildPokemons(pokedexs);

      for (let i = 0; i < existWilds.length; i++) {
        const existing = existWilds[i];
        if (existing.despawn <= now) {
          const newPokemon = newWildsPool[i % newWildsPool.length];
          const spawnTime = new Date();
          const despawnTime = generateDespawnTime(spawnTime);

          wildsToUpdate.push({
            idx: existing.idx,
            pokemon: newPokemon,
            spawnTime,
            despawnTime,
          });
        }
      }
    } else {
      const pokedexs = getWildSpawnTable(data.overworld, overworldData.wild.spawn[data.time], overworldData.wild.count);
      const newWilds = getWildPokemons(pokedexs);

      for (const pokemon of newWilds) {
        const spawnTime = new Date();
        const despawnTime = generateDespawnTime(spawnTime);

        await manager.save(
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
            spawn: spawnTime,
            despawn: despawnTime,
          }),
        );
      }
    }

    for (const { idx, pokemon, spawnTime, despawnTime } of wildsToUpdate) {
      await manager.update(
        LastWild,
        { idx },
        {
          pokedex: pokemon.pokedex,
          gender: pokemon.gender,
          shiny: pokemon.shiny,
          form: pokemon.form,
          skill: Array.isArray(pokemon.skills) ? pokemon.skills : [pokemon.skills],
          spawnType: pokemon.spawn,
          eatenBerry: pokemon.eaten_berry,
          capture: false,
          spawn: spawnTime,
          despawn: despawnTime,
        },
      );
    }

    const finalWilds = await manager.find(LastWild, {
      where: { account: { id: account.id }, location: data.overworld },
    });

    const groundItemsToUpdate: { idx: number; item: ReturnType<typeof getGroundItemsFromCodes>[0]; spawnTime: Date; despawnTime: Date }[] = [];

    if (existGroundItems.length > 0) {
      const itemCodes = getGroundItemSpawnTable(data.overworld, overworldData.groundItem.spawn, overworldData.groundItem.count);
      const groundItemsPool = getGroundItemsFromCodes(itemCodes);

      for (let i = 0; i < existGroundItems.length; i++) {
        const existing = existGroundItems[i];
        if (existing.despawn <= now) {
          const newItem = groundItemsPool[i % groundItemsPool.length];
          const spawnTime = new Date();
          const despawnTime = generateDespawnTime(spawnTime);

          groundItemsToUpdate.push({
            idx: existing.idx,
            item: newItem,
            spawnTime,
            despawnTime,
          });
        }
      }
    } else {
      const itemCodes = getGroundItemSpawnTable(data.overworld, overworldData.groundItem.spawn, overworldData.groundItem.count);
      const groundItems = getGroundItemsFromCodes(itemCodes);

      for (const item of groundItems) {
        const spawnTime = new Date();
        const despawnTime = generateDespawnTime(spawnTime);

        await manager.save(
          manager.create(LastGroundItem, {
            account: { id: account.id },
            location: data.overworld,
            item: item.item,
            stock: item.stock,
            capture: false,
            spawn: spawnTime,
            despawn: despawnTime,
          }),
        );
      }
    }

    for (const { idx, item, spawnTime, despawnTime } of groundItemsToUpdate) {
      await manager.update(
        LastGroundItem,
        { idx },
        {
          item: item.item,
          stock: item.stock,
          capture: false,
          spawn: spawnTime,
          despawn: despawnTime,
        },
      );
    }

    const finalGroundItems = await manager.find(LastGroundItem, {
      where: { account: { id: account.id }, location: data.overworld },
    });

    const captureCountMap = new Map<string, number>();
    if (finalWilds.length > 0) {
      const uniqueKeys = new Set(finalWilds.map((p) => `${p.pokedex}_${p.gender}`));
      const allPcRecords = await manager.find(PC, {
        where: { account: { id: account.id } },
      });
      allPcRecords
        .filter((pc) => uniqueKeys.has(`${pc.pokedex}_${pc.gender}`))
        .forEach((pc) => {
          const key = `${pc.pokedex}_${pc.gender}`;
          captureCountMap.set(key, pc.count);
        });
    }

    result.wilds = finalWilds.map((pokemon) => {
      const pokemonData = getPokemonData(pokemon.pokedex);
      const baseRate = pokemonData.rate.capture;
      const fleeRate = pokemonData.rate.flee;
      const rank = pokemonData.rank;
      const type1 = pokemonData.type1;
      const type2 = pokemonData.type2;

      const count = captureCountMap.get(`${pokemon.pokedex}_${pokemon.gender}`) ?? 0;

      return {
        idx: pokemon.idx,
        pokedex: pokemon.pokedex,
        gender: pokemon.gender,
        shiny: pokemon.shiny,
        fleeRate: fleeRate,
        skills: pokemon.skill,
        form: pokemon.form,
        catch: pokemon.capture,
        eaten_berry: pokemon.eatenBerry,
        baseRate: baseRate,
        count: count,
        type1: type1,
        type2: type2,
        rank: rank,
        spawn: pokemon.spawnType,
      } as Wild;
    });

    result.groundItems = finalGroundItems.map((item) => {
      const itemData = getItemData(item.item);
      const rank = itemData.rank;

      return {
        idx: item.idx,
        item: item.item,
        stock: item.stock,
        catch: item.capture,
        rank: rank,
      } as GroundItem;
    });
  });

  return gameSuccess(result);
};

export const exitSafariZone = async (account: Account, manager?: EntityManager) => {
  const executeCleanup = async (entityManager: EntityManager) => {
    await entityManager.delete(LastWild, { account: { id: account.id } });
    await entityManager.delete(LastGroundItem, { account: { id: account.id } });
  };

  if (manager) {
    await executeCleanup(manager);
  } else {
    await AppDataSource.manager.transaction(executeCleanup);
  }

  return gameSuccess(null);
};

export const catchGroundItem = async (account: Account, data: CatchGroundItemReq) => {
  const groundItem = await Repo.lastGroundItem.findOne({ where: { account: { id: account.id }, idx: data.idx } });
  if (!groundItem) throw new NotFoundIngameItem();
  if (groundItem.capture) throw new Error('This item has already been captured or fled');

  const groundItemData = getItemData(groundItem.item);
  if (!groundItemData) throw new NotFoundIngameItem();

  let ret = null;

  await AppDataSource.manager.transaction(async (manager) => {
    await manager.update(LastGroundItem, { idx: groundItem.idx }, { capture: true });
    ret = await addIngameItem(account, { item: groundItem.item, stock: groundItem.stock }, manager);
  });

  return gameSuccess(ret);
};

export const feedWildEatenBerry = async (account: Account, data: FeedWildEatenBerryReq) => {
  await AppDataSource.manager.transaction(async (manager) => {
    const bagRepo = manager.getRepository(Bag);
    const berryItem = await bagRepo.findOne({
      where: { account: { id: account.id }, item: data.berry },
    });

    if (!berryItem) throw new NotFoundIngameItem();
    if (berryItem.category !== 'berry') throw new NotFoundIngameItem();

    await useItem(account, { item: data.berry, cost: 1 }, manager);
    await manager.update(LastWild, { idx: data.idx }, { eatenBerry: data.berry });
  });

  return gameSuccess(null);
};

export const catchWild = async (account: Account, data: CatchWildReq) => {
  const wild = await Repo.lastWild.findOne({ where: { account: { id: account.id }, idx: data.idx } });
  if (!wild) throw new NotFoundIngamePc();
  if (wild.capture) throw new Error('This pokemon has already been captured or fled');

  const wildData = getPokemonData(wild.pokedex);
  if (!wildData) throw new NotFoundPokemonData();

  const ballData = getCatchItemData(data.ball);
  if (!ballData) throw new NotFoundIngameItem();

  let ret;

  await AppDataSource.manager.transaction(async (manager) => {
    let partyBonus = 0;

    for (const idx of data.parties) {
      if (!idx) continue;

      const party = await manager.findOne(PC, { where: { account: { id: account.id }, idx: idx } });
      if (!party) throw new NotFoundIngamePc();

      const partyData = getPokemonData(party.pokedex);

      // - 이로치: +3% 보너스
      // - 포획 횟수: count당 +0.5% (최대 25%)
      // - RARE(+2%), EPIC(+4%), LEGENDARY(+6%)
      const shinyBonus = party.shiny ? 0.03 : 0;
      const countBonus = Math.min(party.count * 0.005, 0.25);

      let rankBonus = 0;
      switch (partyData.rank) {
        case Rarity.RARE:
          rankBonus = 0.02;
          break;
        case Rarity.EPIC:
          rankBonus = 0.04;
          break;
        case Rarity.LEGENDARY:
          rankBonus = 0.06;
          break;
        default:
          rankBonus = 0;
      }

      partyBonus += shinyBonus + countBonus + rankBonus;
    }

    const berryRate = matchTypeWithBerryRate(data.berry, wildData.type1, wildData.type2);
    const baseRate = wildData.rate.capture * ballData.rate * berryRate;
    const finalRate = Math.min(baseRate + partyBonus, 1.0);

    console.log('Capture calculation:', {
      baseRate: wildData.rate.capture,
      ballRate: ballData.rate,
      berryRate,
      partyBonus,
      finalRate,
    });

    let captureSuccess = Math.random() <= finalRate;

    if (data.ball === '001') captureSuccess = true;

    await useItem(account, { item: data.ball, cost: 1 }, manager);

    if (data.berry) {
      await useItem(account, { item: data.berry, cost: 1 }, manager);
    }

    if (captureSuccess) {
      await manager.update(LastWild, { idx: wild.idx }, { capture: true });
      await addPcPokemon(
        account,
        {
          pokedex: wild.pokedex,
          gender: wild.gender,
          shiny: wild.shiny,
          form: wild.form || '',
          skill: wild.skill && wild.skill.length > 0 ? wild.skill[0] : PokemonSkill.NONE,
          location: wild.location,
          capture_ball: data.ball,
        },
        manager,
      );

      const rewardCandy = getRandomCandyReward(wildData.rank);
      const rewardItems = getRandomRewards(wildData.rank);
      const ingameRepo = manager.getRepository(Ingame);
      const ingame = await ingameRepo.findOne({ where: { account: { id: account.id } } });

      if (ingame) {
        await ingameRepo.update({ account: { id: account.id } }, { candy: ingame.candy + rewardCandy });
      }

      for (const rewardItem of rewardItems) {
        await addIngameItem(account, { item: rewardItem.item, stock: rewardItem.stock }, manager);
      }

      const pc = await manager.findOne(PC, { where: { account: { id: account.id }, pokedex: wild.pokedex, gender: wild.gender } });

      let pcWithData = null;
      if (pc) {
        const pokemonData = getPokemonData(pc.pokedex);
        pcWithData = {
          ...pc,
          rank: pokemonData.rank,
          evol: pokemonData.nextEvol,
          type_1: pokemonData.type1,
          type_2: pokemonData.type2,
        };
      }

      ret = {
        catch: true,
        rewards: {
          pc: pcWithData,
          candy: rewardCandy,
          items: rewardItems,
        },
      };
    } else {
      const fleeResult = Math.random() <= wildData.rate.flee;

      if (fleeResult) {
        await manager.update(LastWild, { idx: wild.idx }, { capture: true, eatenBerry: null });

        ret = {
          catch: false,
          flee: true,
        };
      } else {
        await manager.update(LastWild, { idx: wild.idx }, { eatenBerry: null });

        ret = {
          catch: false,
          flee: false,
        };
      }
    }
  });

  return gameSuccess(ret);
};

export const catchStarterPokemon = async (account: Account, data: CatchStarterPokemonReq) => {
  const ingame = await Repo.ingame.findOne({ where: { account: { id: account.id } } });
  if (!ingame) throw new Error('User not found');
  if (!ingame.isStarter1) throw new Error('User is not in starter');

  const pokemon = await Repo.lastWild.findOne({ where: { account: { id: account.id }, idx: data.idx } });
  if (!pokemon) throw new NotFoundIngamePc();
  if (pokemon.capture) throw new Error('This pokemon has already been captured or fled');

  const pokemonData = getPokemonData(pokemon.pokedex);
  if (!pokemonData) throw new NotFoundPokemonData();

  let ret = null;

  await AppDataSource.manager.transaction(async (manager) => {
    await addPcPokemon(
      account,
      {
        pokedex: pokemon.pokedex,
        gender: pokemon.gender,
        shiny: pokemon.shiny,
        form: pokemon.form || '',
        skill: pokemon.skill && pokemon.skill.length > 0 ? pokemon.skill[0] : PokemonSkill.NONE,
        location: pokemon.location,
        capture_ball: '002',
      },
      manager,
    );
    await exitSafariZone(account, manager);
    await addIngameItem(account, { item: '002', stock: 30 }, manager);
    await addIngameItem(account, { item: '003', stock: 10 }, manager);
    await addIngameItem(account, { item: '004', stock: 5 }, manager);
    await addIngameItem(account, { item: '011', stock: 3 }, manager);
    await addIngameItem(account, { item: '012', stock: 3 }, manager);
    await addIngameItem(account, { item: '014', stock: 3 }, manager);
    await addIngameItem(account, { item: '029', stock: 3 }, manager);
    await manager.update(Ingame, { account: { id: account.id } }, { isStarter0: false, isStarter1: false });
  });

  return gameSuccess(ret);
};
