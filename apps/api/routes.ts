import { Express } from 'express';
import authRoutes from './domains/auth/auth.route';
import userRoutes from './domains/user/user.route';
import pokemonRoutes from './domains/pokemon/pokemon.route';
import itemRoutes from './domains/item/item.route';
import pokedexRoutes from './domains/pokedex/pokedex.route';
import townMapRoutes from './domains/town-map/town-map.route';
import costumeRoutes from './domains/costume/costume.route';
import gameRoutes from './domains/game/game.route';
import safariRoutes from './domains/safari/safari.route';
import fossilRoutes from './domains/fossil/fossil.route';
import internalRoutes from './domains/internal/internal.route';

export function registerRoutes(app: Express) {
  app.use('/api', authRoutes);
  app.use('/api', userRoutes);
  app.use('/api', pokemonRoutes);
  app.use('/api', itemRoutes);
  app.use('/api', pokedexRoutes);
  app.use('/api', townMapRoutes);
  app.use('/api', costumeRoutes);
  app.use('/api', gameRoutes);
  app.use('/api', safariRoutes);
  app.use('/api', fossilRoutes);
  app.use('/api/__internal', internalRoutes);
}
