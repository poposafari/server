export interface ItemBagRes {
  success: true;
  data: {
    itemId: string;
    quantity: number;
    register: boolean;
  }[];
}
