import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import env from '#config/env.js';
import { corsOptions } from '#config/cors.js';
import routes from '#routes/index.js';
import { notFound } from '#middlewares/notFound.js';
import { errorHandler } from '#middlewares/errorHandler.js';
import { apiRateLimiter } from '#modules/auth/auth.rateLimit.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan(env.isDevelopment ? 'dev' : 'combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

app.use('/api', apiRateLimiter, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
