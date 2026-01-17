import express, { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppError, AppErrorCode, AppErrorRes, envConfig } from 'shared';
import apiRouter from './routes';
import { globalLimiter } from './middlewares';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: envConfig.CORS_ORIGIN || '*',
    credentials: true,
  }),
);
app.use(morgan(envConfig.NODE_ENV === 'PROD' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(globalLimiter);

app.use('/health', (req, res) => {
  res.status(200).json({ message: 'Poposafari server is running' });
});

app.use('/api', apiRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`${req.method} ${req.url} Not Found`, 404, AppErrorCode.NOT_FOUND);
  next(error);
});

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  let statusCode = 500;
  let errorCode = AppErrorCode.INTERNAL_SERVER_ERROR;
  let message = 'Internal Server Error';

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
  } else if (error instanceof Error) {
    message = error.message; // TODO: DEV 환경에서만 보이도록 할까? PROD에서는 보안상 위험할 수도 있는데...
    console.error('[UNHANDLED ERROR]', error);
  }

  const response: AppErrorRes = {
    success: false,
    timestamp: new Date().toISOString(),
    error: {
      code: errorCode,
      message,
      status: statusCode,
    },
  };

  res.status(statusCode).json(response);
});

export default app;
