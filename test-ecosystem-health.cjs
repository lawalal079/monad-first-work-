const path = require('path');
require('ts-node').register({
  project: path.resolve(__dirname, 'tsconfig.json'),
});
const { getEcosystemHealthMetrics } = require('./src/services/api');

(async () => {
  try {
    const metrics = await getEcosystemHealthMetrics();
    console.log('Ecosystem Health Metrics (last 24h):');
    console.log(metrics);
  } catch (err) {
    console.error('Error fetching ecosystem health metrics:', err);
  }
})();
