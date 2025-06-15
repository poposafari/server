import bcrypt from 'bcrypt';
import { Repo } from './utils/repo';
import { EntityManager } from 'typeorm';
import { DuplicateAccountHttpError, DuplicateUserNicknameHttpError, LoginFailHttpError, NotFoundAccountHttpError } from './utils/http-error';
import { Ingame } from './entities/Ingame';
import { AppDataSource, redis } from './data-source';
import { Bag } from './entities/Bag';
import { getItemData, getOverworldData } from './store';
import {
  AccountReq,
  BoxBgReq,
  ItemReq,
  ItemCategoryReq,
  ItemType,
  MAX_BUY,
  MAX_STOCK,
  MovePokemonReq,
  MyPokemonReq,
  OverworldType,
  PokeboxSelectReq,
  PokemonGender,
  PokemonSkill,
  RegisterReq,
  SaltOrRounds,
  SlotReq,
  UseTicketReq,
  GameLogicErrorCode,
  MoveToOverworldReq,
  WildPokemon,
  GroundItem,
  MAX_GROUNDITEM,
  MAX_PER_BOX,
  PartyReq,
  CatchSafariObjectReq,
} from './utils/type';
import {
  gameFail,
  gameSuccess,
  getAvatarEnum,
  getGenderEnum,
  getGroundItems,
  getNextPokeboxIndex,
  getSpawnEnum,
  getWildPokemons,
  getWildSpawnTable,
  setDefaultBoxes,
  setDefaultBoxesCnt,
} from './utils/methods';
import { Pokebox } from './entities/Pokebox';
import { Wild } from './entities/Wild';
import { Grounditem } from './entities/Grounditem';

export const registerAccount = async (data: AccountReq) => {
  const accountRepo = Repo.account;

  const exist = await accountRepo.findOneBy({
    username: data.username,
  });

  console.log(exist);

  if (exist) throw new DuplicateAccountHttpError();

  const hashedPassword = await bcrypt.hash(data.password, SaltOrRounds);
  const account = accountRepo.create({ ...data, password: hashedPassword });

  await accountRepo.save(account);

  return account;
};

export const login = async (data: AccountReq) => {
  const accountRepo = Repo.account;
  const exist = await accountRepo.findOneBy({
    username: data.username,
  });

  if (!exist) throw new LoginFailHttpError();
  if (exist.password && (await bcrypt.compare(data.password, exist.password))) return exist;

  return null;
};

export const autoLogin = async (ingame: Ingame) => {
  const items = await getItems(ingame);

  const ret = {
    nickname: ingame.nickname,
    x: ingame.x,
    y: ingame.y,
    location: ingame.location,
    money: ingame.money,
    gender: ingame.gender,
    avatar: ingame.avatar,
    boxes: ingame.boxes,
    party: ingame.party,
    itemslot: ingame.itemslot,
    items: items,
  };

  return gameSuccess(ret);
};

export const removeAccount = async (user: number) => {
  const accountRepo = Repo.account;

  const exist = await accountRepo.findOneBy({
    id: user,
  });

  if (!exist) throw new NotFoundAccountHttpError();

  await accountRepo.delete({ id: exist.id });

  return gameSuccess(null);
};

export const registerIngame = async (data: RegisterReq, user: number) => {
  const ingameRepo = Repo.ingame;
  let ret;

  const exist = await ingameRepo.findOneBy({
    nickname: data.nickname,
  });

  if (exist) throw new DuplicateUserNicknameHttpError();

  ret = {
    account_id: user,
    x: 10,
    y: 10,
    location: '000',
    money: 5000,
    nickname: data.nickname,
    gender: getGenderEnum(data.gender),
    avatar: getAvatarEnum(data.avatar),
    boxes: setDefaultBoxes(),
    boxes_cnt: setDefaultBoxesCnt(),
    party: [],
    itemslot: [null, null, null, null, null, null, null, null, null],
  };

  const ingameAccount = ingameRepo.create(ret);

  await ingameRepo.save(ingameAccount);

  return gameSuccess(ingameAccount);
};

export const getIngame = async (ingame: Ingame) => {
  let ret;

  await AppDataSource.manager.transaction(async (manager) => {
    const items = await getItems(ingame, manager);

    ret = {
      nickname: ingame.nickname,
      x: ingame.x,
      y: ingame.y,
      location: ingame.location,
      money: ingame.money,
      gender: ingame.gender,
      avatar: ingame.avatar,
      boxes: ingame.boxes,
      party: ingame.party,
      itemslot: ingame.itemslot,
      items: items,
    };
  });
  return gameSuccess(ret);
};

export const updateItemSlot = async (ingame: Ingame, itemSlot: SlotReq) => {
  const ingameRepo = Repo.ingame;

  await ingameRepo.update(ingame.account_id, {
    itemslot: itemSlot.data,
  });

  return gameSuccess(null);
};

export const updateParty = async (ingame: Ingame, party: PartyReq) => {
  const ingameRepo = Repo.ingame;

  await ingameRepo.update(ingame.account_id, {
    party: party.data,
  });

  return gameSuccess(null);
};

export const updatePokeboxBg = async (ingame: Ingame, backgrounds: BoxBgReq) => {
  const ingameRepo = Repo.ingame;

  await ingameRepo.update(ingame.account_id, {
    boxes: backgrounds.data,
  });

  return gameSuccess(null);
};

export const getAvailableTicket = async (ingame: Ingame) => {
  return gameSuccess(ingame.available_ticket);
};

export const receiveAvailableTicket = async (ingame: Ingame) => {
  await AppDataSource.manager.transaction(async (manager) => {
    const ticket = ingame.available_ticket;

    await manager.update(Ingame, { account_id: ingame.account_id }, { available_ticket: 0 });
    await addItem(ingame, { item: '030', stock: ticket }, manager);
  });
  return gameSuccess(null);
};

export const addItem = async (ingame: Ingame, item: ItemReq, manager?: EntityManager): Promise<any> => {
  const bagRepo = manager ? manager.getRepository(Bag) : Repo.bag;
  const itemType = getItemData(item.item)?.type;

  if (!itemType) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);
  if (item.stock <= 0 || item.stock > MAX_STOCK) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);

  const exist = await bagRepo.findOne({
    where: { account_id: ingame.account_id, item: item.item },
  });

  if (exist) {
    exist.stock += item.stock;

    if (exist.stock > MAX_STOCK) return gameFail(GameLogicErrorCode.MAX_STOCK);

    await bagRepo.save(exist);

    return gameSuccess(exist);
  } else {
    const newItem = bagRepo.create({
      account_id: ingame.account_id,
      item: item.item,
      category: itemType,
      stock: item.stock,
    });

    await bagRepo.save(newItem);

    return gameSuccess(newItem);
  }
};

export const buyItem = async (ingame: Ingame, item: ItemReq) => {
  let ret;
  await AppDataSource.manager.transaction(async (manager) => {
    const itemData = getItemData(item.item);

    if (!itemData) {
      ret = gameFail(GameLogicErrorCode.NOT_FOUND_DATA);
      return;
    }
    if (!itemData.purchasable) {
      ret = gameFail(GameLogicErrorCode.NOT_PURCHASABEE_ITEM);
      return;
    }
    if (item.stock <= 0 || item.stock > MAX_BUY) {
      ret = gameFail(GameLogicErrorCode.WRONG_REQUEST_STOCK);
      return;
    }

    const bag = await manager.findOne(Bag, { where: { account_id: ingame.account_id, item: item.item } });
    const cost = item.stock * itemData.price;
    let result: ItemReq;

    if (cost > ingame.money) {
      ret = gameFail(GameLogicErrorCode.NOT_ENOUGH_CANDY);
      return;
    }

    ingame.money -= cost;

    if (bag) {
      const newStock = bag.stock + item.stock;
      if (newStock > MAX_STOCK) {
        ret = gameFail(GameLogicErrorCode.MAX_STOCK);
        return;
      }

      bag.stock = newStock;
      await manager.save(bag);
      result = bag;
    } else {
      result = await addItem(ingame, item, manager);
    }
    await manager.save(ingame);

    ret = gameSuccess({
      candy: ingame.money,
      item: result.item,
      category: itemData.type,
      stock: result.stock,
    });
  });

  return ret;
};

export const useItem = async (ingame: Ingame, item: ItemReq, manager?: EntityManager): Promise<any> => {
  const bagRepo = manager ? manager.getRepository(Bag) : Repo.bag;
  const bag = await bagRepo.findOne({ where: { account_id: ingame.account_id, item: item.item } });

  if (!bag) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);
  if (bag.stock < item.stock) return gameFail(GameLogicErrorCode.NOT_ENOUGH_STOCK);
  if (item.stock <= 0) return gameFail(GameLogicErrorCode.WRONG_REQUEST_STOCK);
  if (bag.stock - item.stock <= 0) {
    return gameSuccess(await bagRepo.delete(bag));
  }

  bag.stock -= item.stock;

  await bagRepo.save(bag);

  return gameSuccess(bag);
};

export const getItemByCategory = async (ingame: Ingame, item: ItemCategoryReq): Promise<any> => {
  const bagRepo = Repo.bag;
  const bag = await bagRepo.find({
    where: { account_id: ingame.account_id, category: item.category },
  });
  const ret = bag.map((item) => ({
    item: item.item,
    stock: item.stock,
  }));

  return gameSuccess(ret);
};

export const getItems = async (ingame: Ingame, manager?: EntityManager): Promise<any> => {
  const bagRepo = manager ? manager.getRepository(Bag) : Repo.bag;
  const bag = await bagRepo.find({ where: { account_id: ingame.account_id } });
  const ret = bag.map((item) => ({
    item: item.item,
    category: item.category,
    stock: item.stock,
  }));

  if (manager) return ret;

  return gameSuccess(ret);
};

export const addPokemon = async (ingame: Ingame, pokemon: MyPokemonReq) => {
  const pokeboxRepo = Repo.pokebox;
  const pokebox = await pokeboxRepo.findOneBy({
    account_id: ingame.account_id,
    pokedex: pokemon.pokedex,
    gender: pokemon.gender,
  });

  if (pokebox) {
    const currentSkills = pokebox.skill || [];
    const hasSkill = pokemon.skill !== PokemonSkill.NONE && !currentSkills.includes(pokemon.skill);
    const newSkill = hasSkill ? [...currentSkills, pokemon.skill] : currentSkills;

    await pokeboxRepo.update(
      { account_id: ingame.account_id, pokedex: pokemon.pokedex, gender: pokemon.gender },
      {
        shiny: pokebox.shiny ? true : pokemon.shiny,
        form: pokemon.form,
        count: pokebox.count + 1,
        skill: newSkill,
        capture_location: pokemon.location,
        capture_ball: pokemon.capture_ball,
      },
    );
  } else {
    const nextPokebox = getNextPokeboxIndex(ingame.boxes_cnt);

    console.log(nextPokebox);

    await AppDataSource.manager.transaction(async (manager) => {
      const newPokemon = pokeboxRepo.create({
        account_id: ingame.account_id,
        pokedex: pokemon.pokedex,
        gender: pokemon.gender,
        shiny: pokemon.shiny,
        form: pokemon.form,
        skill: pokemon.skill === 'none' ? [] : [pokemon.skill],
        box: nextPokebox[0],
        capture_location: pokemon.location,
        capture_ball: pokemon.capture_ball,
      });

      await updatePokeboxCnt(ingame.account_id, nextPokebox[0], nextPokebox[1] + 1, manager);
      await pokeboxRepo.save(newPokemon);
    });
  }

  return gameSuccess(null);
};

export const updatePokeboxCnt = async (account_id: number, idx: number, value: number, manager?: EntityManager) => {
  const ingameRepo = manager ? manager.getRepository(Ingame) : Repo.ingame;

  await ingameRepo.query(`UPDATE db0.ingame SET boxes_cnt[$1] = $2 WHERE account_id = $3`, [idx + 1, value, account_id]);
};

export const getPokebox = async (ingame: Ingame, search: PokeboxSelectReq, manager?: EntityManager) => {
  const pokeboxRepo = manager ? manager.getRepository(Pokebox) : Repo.pokebox;
  const pokebox = await pokeboxRepo.find({
    where: {
      account_id: ingame.account_id,
      box: search.box,
    },
    order: {
      update_date: 'ASC',
    },
  });

  if (!pokebox) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);

  const ret = pokebox.map((data) => ({
    pokedex: data.pokedex,
    gender: data.gender,
    shiny: data.shiny,
    form: data.form,
    count: data.count,
    skill: data.skill,
    captureDate: data.capture_date,
    captureBall: data.capture_ball,
    captureLocation: data.capture_location,
    nickname: data.nickname,
  }));

  return gameSuccess(ret);
};

export const movePokemon = async (ingame: Ingame, info: MovePokemonReq) => {
  let ret;

  await AppDataSource.manager.transaction(async (manager) => {
    const pokeboxRepo = Repo.pokebox;
    const pokemon = pokeboxRepo.findOneBy({
      account_id: ingame.account_id,
      pokedex: info.pokedex,
      gender: info.gender as PokemonGender,
    });

    if (!pokemon) {
      ret = gameFail(GameLogicErrorCode.NOT_FOUND_DATA);
      return;
    }
    if (ingame.boxes_cnt[info.to] >= MAX_PER_BOX) {
      ret = gameFail(GameLogicErrorCode.FULL_BOX);
      return;
    }

    await updatePokeboxCnt(ingame.account_id, info.from, ingame.boxes_cnt[info.from] - 1, manager);
    await updatePokeboxCnt(ingame.account_id, info.to, ingame.boxes_cnt[info.to] + 1, manager);
    await pokeboxRepo.update(
      { account_id: ingame.account_id, pokedex: info.pokedex, gender: info.gender },
      {
        box: info.to,
      },
    );

    ret = gameSuccess(await getPokebox(ingame, { box: info.from }, manager));
  });

  return ret;
};

export const useTicket = async (ingame: Ingame, data: UseTicketReq) => {
  const bagRepo = Repo.bag;
  const overworld = getOverworldData(data.overworld);
  const bag = await bagRepo.findOne({
    where: { account_id: ingame.account_id, item: '030' },
  });

  if (!bag) return gameFail(GameLogicErrorCode.NOT_ENOUGH_TICKET);

  const newStock = bag.stock - overworld.cost;

  if (newStock < 0) {
    return gameFail(GameLogicErrorCode.NOT_ENOUGH_TICKET);
  } else {
    bag.stock = newStock;
    await useItem(ingame, { item: '030', stock: overworld.cost });
  }

  return gameSuccess({
    item: '030',
    category: ItemType.ETC,
    stock: bag.stock,
  });
};

export const moveToOverworld = async (ingame: Ingame, data: MoveToOverworldReq) => {
  const overworld = getOverworldData(data.overworld);

  let result: { pokemons: WildPokemon[]; items: GroundItem[]; entryX: number; entryY: number } = {
    pokemons: [],
    items: [],
    entryX: overworld.x,
    entryY: overworld.y,
  };

  await AppDataSource.manager.transaction(async (manager) => {
    if (overworld.type === OverworldType.SAFARI) {
      const existWild = await manager.find(Wild, {
        where: { account_id: ingame.account_id, overworld: data.overworld },
      });

      if (existWild.length > 0) {
        const existGroundItems = await manager.find(Grounditem, {
          where: { account_id: ingame.account_id, overworld: data.overworld },
        });

        result.pokemons = existWild.map((pokemon) => ({
          idx: pokemon.idx,
          pokedex: pokemon.pokedex,
          gender: pokemon.gender,
          shiny: pokemon.shiny,
          skills: pokemon.skills,
          form: pokemon.form,
          catch: pokemon.catch,
          spawns: getSpawnEnum(pokemon.spawns),
        }));

        result.items = existGroundItems.map((item) => ({
          idx: item.idx,
          item: item.item,
          stock: item.stock,
          catch: item.catch,
        }));

        await manager.update(Ingame, { account_id: ingame.account_id }, { location: data.overworld, x: overworld.x, y: overworld.y });
        return;
      }

      const pokedexs = getWildSpawnTable(overworld.spawn, overworld.spawnCount);
      const groundItems = getGroundItems(Math.floor(Math.random() * MAX_GROUNDITEM));
      const wildPokemons = getWildPokemons(pokedexs);

      result.pokemons = wildPokemons;
      result.items = groundItems;
      result.entryX = overworld.x;
      result.entryY = overworld.y;

      const wildEntities = wildPokemons.map((pokemon) =>
        manager.create(Wild, {
          account_id: ingame.account_id,
          overworld: data.overworld,
          pokedex: pokemon.pokedex,
          gender: pokemon.gender,
          shiny: pokemon.shiny,
          skills: pokemon.skills,
          form: pokemon.form,
          catch: false,
          spawns: pokemon.spawns.toString(),
        }),
      );
      await manager.save(wildEntities);

      const grounditemEntities = groundItems.map((item) =>
        manager.create(Grounditem, {
          account_id: ingame.account_id,
          overworld: data.overworld,
          item: item.item,
          stock: item.stock,
          catch: false,
        }),
      );
      await manager.save(grounditemEntities);
    } else {
      await manager.delete(Wild, { account_id: ingame.account_id });
      await manager.delete(Grounditem, { account_id: ingame.account_id });
    }

    await manager.update(Ingame, { account_id: ingame.account_id }, { location: data.overworld, x: overworld.x, y: overworld.y });
  });

  return gameSuccess(result);
};

export const catchGroundItem = async (ingame: Ingame, data: CatchSafariObjectReq) => {
  const repo = Repo.GrounditemSpawns;
  const item = await repo.findOneBy({ idx: data.idx });
  let ret;

  if (!item) return gameFail(GameLogicErrorCode.NOT_FOUND_DATA);

  await AppDataSource.manager.transaction(async (manager) => {
    await manager.update(
      Grounditem,
      { account_id: ingame.account_id, idx: data.idx },
      {
        catch: true,
      },
    );

    ret = await addItem(ingame, { item: item.item, stock: item.stock }, manager);
  });

  return gameSuccess(ret);
};
