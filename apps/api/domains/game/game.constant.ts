/** 스타팅 고정 27마리 (지방마다 스타팅 포켓몬 3마리) */
export const STARTING_POKEMONS = [
  // 관동지방
  '0001',
  '0004',
  '0007',
  // 성도지방
  '0152',
  '0155',
  '0158',
  // 호연지방
  '0252',
  '0255',
  '0258',
  // 신오지방
  '0387',
  '0390',
  '0393',
  // 하나지방
  '0495',
  '0498',
  '0501',
  // 칼로스지방
  '0650',
  '0653',
  '0656',
  // 알로라지방
  '0722',
  '0725',
  '0728',
  // 가라르지방
  '0810',
  '0813',
  '0816',
  // 팔데아지방
  '0906',
  '0909',
  '0912',
];

/** 스타팅 아이템 */
export const STARTING_ITEMS = [
  { item: 'poke-ball', quantity: 20 },
  { item: 'great-ball', quantity: 10 },
  { item: 'ultra-ball', quantity: 5 },
];

/** 도감 번호 1 ~ 1025 중 럭키 박스 */
export const LUCKY_STARTING_MIN = 1;
export const LUCKY_STARTING_MAX = 1025;

/** 스타팅 총 개수 (고정 27 + 럭키 박스 3) */
export const STARTING_TOTAL = 30;
