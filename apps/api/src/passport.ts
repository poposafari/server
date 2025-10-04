// // /Users/ihoseob/Desktop/seophohoho/project/poposerver/apps/api/src/passport-setup.ts
// import passport from 'passport';
// import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// import { Strategy as DiscordStrategy } from 'passport-discord';
// import { Account } from './entities/Account';
// import { AppDataSource, redis } from './data-source';
// import { VerifyCallback } from 'passport-google-oauth20';
// import dotenv from 'dotenv';

// dotenv.config();

// passport.serializeUser((user: any, done: (error: any, id?: string) => void) => {
//   console.log('Serialize User');
//   done(null, user.id);
// });

// passport.deserializeUser(async (id: string, done: (err: any, user?: any) => void) => {
//   console.log('Deserialize User');
//   try {
//     const accountRepository = AppDataSource.getRepository(Account);
//     const user = await accountRepository.findOneBy({ id: parseInt(id) });
//     done(null, user);
//   } catch (err) {
//     done(err);
//   }
// });

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID!,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
//       callbackURL: '/api/account/google/callback',
//       passReqToCallback: true,
//     },
//     async (req, accessToken, refreshToken, profile, done) => {
//       console.log('Google Profile : ', profile);
//       try {
//         const accountRepository = AppDataSource.getRepository(Account);
//         let user = await accountRepository.findOne({ where: { provider_id: profile.id } });

//         if (!user) {
//           user = accountRepository.create({
//             provider: 'google',
//             provider_id: profile.id,
//           });
//           await accountRepository.save(user);
//         }

//         return done(null, user);
//       } catch (error) {
//         return done(error);
//       }
//     },
//   ),
// );

// passport.use(
//   new DiscordStrategy(
//     {
//       clientID: process.env.DISCORD_CLIENT_ID!,
//       clientSecret: process.env.DISCORD_CLIENT_SECRET!,
//       callbackURL: process.env.DISCORD_CALLBACK_URL!,
//       scope: ['identify', 'email'],
//     },
//     async (_accessToken, _refreshToken, profile, done) => {
//       console.log('Discord Profile : ', profile);
//       try {
//         const accountRepository = AppDataSource.getRepository(Account);
//         let user = await accountRepository.findOne({ where: { discordId: profile.id } });

//         if (!user) {
//           user = accountRepository.create({
//             discordId: profile.id,
//             username: profile.username,
//           });
//           await accountRepository.save(user);
//         }
//         return done(null, user);
//       } catch (error) {
//         return done(error);
//       }
//     },
//   ),
// );
