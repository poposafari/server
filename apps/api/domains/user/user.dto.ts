export interface CreateUserRes {
  success: true;
  data: null;
}

export interface UserGameDataRes {
  success: true;
  data: {
    profile: {
      nickname: string;
      gender: number;
      money: number;
      playtime: number;
      hasStarter: boolean;
      lastMapId: string;
      lastX: number;
      lastY: number;
    };
    equippedCostumes: { costumeId: string }[];
    party: {
      id: number;
      pokedexId: number;
      level: number;
      friendship: number;
      gender: number;
      isShiny: boolean;
      nickname: string | null;
      tier: string | null;
      abilityId: string;
      natureId: string;
      skills: unknown;
      heldItemId: string | null;
      partySlot: number | null;
      ballId: number;
      caughtLocation: string;
      caughtAt: string;
    }[];
    itemSlots: {
      itemId: string;
      quantity: number;
      register: boolean;
    }[];
    pokedex: {
      pokedexId: string;
      caughtCount: number;
    }[];
    pokemonBoxCount: number;
    visitedMaps: string[];
    safariTicket: {
      available: number;
      cap: number;
      nextTicketAt: number | null;
      nextTicketInMs: number | null;
    };
  };
}
