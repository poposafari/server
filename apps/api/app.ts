import express from 'express';
import cors from 'cors';
import passport from 'passport';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { HttpError } from './src/utils/http-error';
import routes from './src/routes';
import './src/passport';

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];
const app = express();

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
    },
  });
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());

app.use('/api/account', routes.AccountRouter);
app.use('/api/ingame', routes.IngameRouter);
app.use('/api/bag', routes.BagRouter);
app.use('/api/pc', routes.PcRouter);
app.use('/api/safari', routes.SafariRouter);

app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json(err.toJson());
  }

  console.error('Server Error!', err);
  return res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
