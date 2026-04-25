const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const client = new BetaAnalyticsDataClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
});

const PROPERTY_ID = process.env.GA_PROPERTY_ID;

// ✅ VISITOR STATS
async function getVisitorStatsDetailed() {
  try {
    const [response] = await client.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'totalUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }]
    });

    const rows = response.rows || [];

    let total = 0;
    let today = 0;
    let last7Days = [];

    rows.forEach((row, index) => {
      const date = row.dimensionValues[0].value;
      const count = parseInt(row.metricValues[0].value);

      total += count;

      last7Days.push({ date, count });

      if (index === rows.length - 1) {
        today = count;
      }
    });

    return {
      total,
      today,
      week: total,
      month: total,
      last7Days,
      source: 'google-analytics'
    };

  } catch (error) {
    console.error("❌ GA ERROR:", error.message);

    return {
      total: 0,
      today: 0,
      week: 0,
      month: 0,
      last7Days: [],
      source: 'error'
    };
  }
}

// ✅ PAGE STATS
async function getPageStats() {
  try {
    const [response] = await client.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }]
    });

    return (response.rows || []).map(row => ({
      page: row.dimensionValues[0].value,
      views: parseInt(row.metricValues[0].value)
    }));

  } catch (error) {
    console.error("❌ PAGE ERROR:", error.message);
    return [];
  }
}

module.exports = {
  getVisitorStatsDetailed,
  getPageStats
};