import { ItemType } from "./enums";

export interface LoginData {
  username: string;
  password: string;
}

export interface Item {
  item: string;
  stock: number;
}

export interface ItemSel {
  category: ItemType;
}

export interface RegisterReq {
  gender: "boy" | "girl";
  avatar: "1" | "2" | "3" | "4";
  nickname: string;
}

export interface ItemSlotData {
  slot1: string;
  slot2: string;
  slot3: string;
  slot4: string;
  slot5: string;
  slot6: string;
  slot7: string;
  slot8: string;
  slot9: string;
}
