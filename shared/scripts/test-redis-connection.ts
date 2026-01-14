// import { RedisStore, RedisKeys } from 'legacy2/shared';

// async function testRedis() {
//   await RedisStore.connect();

//   const userId = 101;
//   const key = RedisKeys.userSession(userId);

//   await RedisStore.setJson(key, { map: 'p001', x: 10, y: 20 });

//   const session = await RedisStore.getJson(key);
//   console.log(session);
// }

// testRedis();
