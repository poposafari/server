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
import { getCatchItemData, getItemData, getOverworldData, getPokemonData } from './shared/data';
import {
  createTokens,
  gameSuccess,
  getGenderEnum,
  getGroundItemsFromCodes,
  getGroundItemSpawnTable,
  getNextPcBoxNum,
  getRandomCandyReward,
  getRandomReward,
  getRandomRewards,
  getWildPokemons,
  getWildSpawnTable,
  matchPokemonWithRarityRate,
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
  CatchWildReq,
  EnterSafariZoneReq,
  EvolvePcReq,
  GetPcReq,
  LoginLocalReq,
  MovePcReq,
  RegisterIngameReq,
  RegisterLocalReq,
  UseItemReq,
} from './shared/interfaces';
import { EVOLVE_BONUS_CNT, MAX_BUY, MAX_GROUNDITEM, MAX_PER_BOX, MAX_STOCK, SaltOrRounds } from './shared/constants';
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

      result.groundItems = existGroundItems.map((item) => {
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

      return;
    }

    const pokedexs = getWildSpawnTable(overworldData.wild.spawn, overworldData.wild.count);
    const itemCodes = getGroundItemSpawnTable(overworldData.groundItem.spawn, overworldData.groundItem.count);
    const groundItems = getGroundItemsFromCodes(itemCodes);
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

    result.groundItems = retGroundItems.map((item) => {
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

export const exitSafariZone = async (account: Account) => {
  await AppDataSource.manager.transaction(async (manager) => {
    await manager.delete(LastWild, { account: { id: account.id } });
    await manager.delete(LastGroundItem, { account: { id: account.id } });
  });

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

      ret = {
        catch: true,
        rewards: {
          candy: rewardCandy,
          items: rewardItems,
        },
      };
    } else {
      const fleeResult = Math.random() <= wildData.rate.flee;

      if (fleeResult) {
        await manager.update(LastWild, { idx: wild.idx }, { capture: true });

        ret = {
          catch: false,
          flee: true,
        };
      } else {
        ret = {
          catch: false,
          flee: false,
        };
      }
    }
  });

  return gameSuccess(ret);
};

export const getStarterPokemon = async (account: Account) => {};
