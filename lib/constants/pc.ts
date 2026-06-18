//클라이언트(`client/src/feats/pc/pc.const.ts`)와 반드시 동기화할 것.
//박스 개수/슬롯 수를 바꾸면 양쪽을 함께 수정해야 한다.

export const PC_STORAGE = {
  MAX_BOX: 50,
  GRID_PER_BOX: 30,
} as const;

export const PC_BOX_CAPACITY = PC_STORAGE.MAX_BOX * PC_STORAGE.GRID_PER_BOX;
