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
      gender: number;
      isShiny: boolean;
      nickname: string | null;
      abilityId: number;
      natureId: number;
      skills: unknown;
      heldItemId: number | null;
      partySlot: number | null;
      ballId: number;
    }[];
    itemSlots: {
      itemId: number;
      quantity: number;
      slotNumber: number | null;
    }[];
  };
}
