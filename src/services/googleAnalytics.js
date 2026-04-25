const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const client = new BetaAnalyticsDataClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
});

const PROPERTY_ID = process.env.GA_PROPERTY_ID;

async function getVisitorStatsDetailed() {
  try {
    const [response] = await client.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    });

    console.log("🔥 GA RAW:", JSON.stringify(response, null, 2));

    // ✅ FIXED: No dimension, so only total value
    const total = parseInt(response.rows?.[0]?.metricValues?.[0]?.value || 0);

    return {
      total,
      today: total,   // temporary
      week: total,
      month: total,
      last7Days: [],
      source: 'google-analytics'
    };

  } catch (error) {
    console.error("❌ GA ERROR:", error);

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

module.exports = { getVisitorStatsDetailed };