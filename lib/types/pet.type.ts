import { z } from 'zod';

export interface PetInfo {
  pokedexId: string;
  isShiny: boolean;
}

export type PetState = PetInfo | null;

// client → socket
export interface PetChangeReq {
  pokedexId: string | null;
  isShiny: boolean;
}

// socket → 같은 방의 다른 클라이언트
export interface OtherPetChangeRes {
  userId: string;
  pokedexId: string | null;
  isShiny: boolean;
}

export const petChangeReqSchema = z.object({
  pokedexId: z.string().min(1).nullable(),
  isShiny: z.boolean(),
});
