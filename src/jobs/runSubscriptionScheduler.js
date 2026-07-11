/**
 * Job CLI para cron externo (Railway, systemd, GitHub Actions, etc.):
 *   node src/jobs/runSubscriptionScheduler.js
 *   npm run job:subscriptions
 */
import env from '#config/env.js';
import { connectDatabase } from '#database/connection.js';
import { subscriptionScheduler } from '#services/subscription-engine/index.js';

const run = async () => {
  await connectDatabase();
  console.log(`[job:subscriptions] Inicio — grace=${env.subscription.gracePeriodDays}d`);
  const result = await subscriptionScheduler.runDaily({ source: 'scheduler' });
  console.log('[job:subscriptions] Resultado:', JSON.stringify(result, null, 2));
  process.exit(result?.summary?.errors?.length ? 1 : 0);
};

run().catch((error) => {
  console.error('[job:subscriptions] Falló:', error);
  process.exit(1);
});
