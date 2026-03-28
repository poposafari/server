export interface ItemBagRes {
  success: true;
  data: {
    itemId: number;
    quantity: number;
    slotNumber: number | null;
  }[];
}
