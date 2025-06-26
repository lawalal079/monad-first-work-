   import { getEcosystemHealthMetrics } from './src/services/api';

   (async () => {
     try {
       const metrics = await getEcosystemHealthMetrics();
       console.log('Ecosystem Health Metrics (last 24h):');
       console.log(metrics);
     } catch (err) {
       console.error('Error fetching ecosystem health metrics:', err);
     }
   })();   