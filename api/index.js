/**
 * Entrada serverless para Vercel (Fluid / Node.js).
 * No usa app.listen ni node-cron in-process.
 */
import app from '../src/app.js';
import { ensureAppReady } from '../src/ready.js';

await ensureAppReady();

export default app;
