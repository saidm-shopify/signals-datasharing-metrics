// ─── Query Builder ───
// All queries are parameterized by date range (days) and optional partner filter

const KNOWN_PARTNERS = [
  { id: '3977633', name: 'Attentive' },
  { id: '5829751', name: 'Criteo' },
  { id: '2329312', name: 'Facebook & Instagram' },
  { id: '1780363', name: 'Google & YouTube' },
  { id: '32196493313', name: 'HubSpot' },
  { id: '123074', name: 'Klaviyo' },
  { id: '2585307', name: 'Mailchimp' },
  { id: '2997493', name: 'Microsoft Channel' },
  { id: '186001', name: 'Omnisend' },
  { id: '3009811', name: 'Pinterest' },
  { id: '2328352', name: 'Postscript' },
  { id: '1615517', name: 'PushOwl/Brevo' },
  { id: '2556259', name: 'Snapchat Ads' },
  { id: '4383523', name: 'TikTok' },
  { id: '6455335', name: 'X (Twitter)' },
  { id: '740217', name: 'Yotpo' },
];

// Default 5 partners shown on page load
const DEFAULT_PARTNER_IDS = ['4383523', '2556259', '6455335', '3009811', '2997493'];

function partnerIdToName(id) {
  const p = KNOWN_PARTNERS.find(p => p.id === String(id));
  return p ? p.name : `Partner ${id}`;
}

function partnerIdsToSql(ids) {
  return ids.map(id => `'${id}'`).join(', ');
}

function buildQueries(days, selectedPartnerIds) {
  const interval = `INTERVAL ${days} DAY`;
  const isAll = selectedPartnerIds.length === KNOWN_PARTNERS.length;
  const idList = partnerIdsToSql(selectedPartnerIds);

  // WPM filter: always filter to selected partners
  const pFilterWpm = isAll ? '' : `AND payload.api_client_id IN (${idList})`;
  // SP filter: always filter to selected partners (after UNNEST)
  const pFilterSp = isAll ? '' : `AND api_client_id IN (${idList})`;

  return {
    // 1. WPM totals
    wpmTotals: `
      SELECT
        COUNT(*) AS total_blocked_events,
        COUNT(DISTINCT payload.shop_id) AS unique_shops,
        COUNT(DISTINCT payload.api_client_id) AS unique_api_clients
      FROM \`sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_blocked_1\`
      WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), ${interval})
        ${pFilterWpm}
    `,

    // 2. SP totals (deduplicated by event_id)
    spTotals: !isAll ? `
      SELECT
        COUNT(DISTINCT payload.event_id) AS total_blocked_events,
        COUNT(DISTINCT payload.shop_id) AS unique_shops
      FROM \`sdp-ingest.monorail.monorail_server_pixel_data_sharing_observability_1\`,
        UNNEST(payload.api_client_ids) AS api_client_id
      WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), ${interval})
        AND payload.action = 'BLOCKED'
        ${pFilterSp}
    ` : `
      SELECT
        COUNT(DISTINCT payload.event_id) AS total_blocked_events,
        COUNT(DISTINCT payload.shop_id) AS unique_shops
      FROM \`sdp-ingest.monorail.monorail_server_pixel_data_sharing_observability_1\`
      WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), ${interval})
        AND payload.action = 'BLOCKED'
    `,

    // 3. WPM by partner
    wpmByPartner: `
      SELECT
        payload.api_client_id,
        COUNT(*) AS blocked_events,
        COUNT(DISTINCT payload.shop_id) AS unique_shops,
        COUNT(DISTINCT DATE(event_timestamp)) AS active_days
      FROM \`sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_blocked_1\`
      WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), ${interval})
        AND payload.api_client_id IS NOT NULL
        AND SAFE_CAST(payload.api_client_id AS INT64) IS NOT NULL
        ${pFilterWpm}
      GROUP BY payload.api_client_id
      ORDER BY blocked_events DESC
    `,

    // 4. SP by partner (deduplicated by event_id + api_client_id)
    spByPartner: `
      SELECT
        api_client_id,
        COUNT(DISTINCT payload.event_id) AS blocked_events
      FROM \`sdp-ingest.monorail.monorail_server_pixel_data_sharing_observability_1\`,
        UNNEST(payload.api_client_ids) AS api_client_id
      WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), ${interval})
        AND payload.action = 'BLOCKED'
        ${pFilterSp}
      GROUP BY api_client_id
      ORDER BY blocked_events DESC
    `,

    // 5. WPM daily trend
    wpmDailyTrend: `
      SELECT
        DATE(event_timestamp) AS day,
        COUNT(*) AS blocked_events
      FROM \`sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_blocked_1\`
      WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), ${interval})
        ${pFilterWpm}
      GROUP BY day
      ORDER BY day
    `,

    // 6. SP daily trend (deduplicated by event_id)
    spDailyTrend: !isAll ? `
      SELECT
        DATE(event_timestamp) AS day,
        COUNT(DISTINCT payload.event_id) AS blocked_events
      FROM \`sdp-ingest.monorail.monorail_server_pixel_data_sharing_observability_1\`,
        UNNEST(payload.api_client_ids) AS api_client_id
      WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), ${interval})
        AND payload.action = 'BLOCKED'
        ${pFilterSp}
      GROUP BY day
      ORDER BY day
    ` : `
      SELECT
        DATE(event_timestamp) AS day,
        COUNT(DISTINCT payload.event_id) AS blocked_events
      FROM \`sdp-ingest.monorail.monorail_server_pixel_data_sharing_observability_1\`
      WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), ${interval})
        AND payload.action = 'BLOCKED'
      GROUP BY day
      ORDER BY day
    `,

    // 7. WPM blocked by event name
    wpmByEventName: `
      SELECT
        payload.event_name,
        COUNT(*) AS blocked_events
      FROM \`sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_blocked_1\`
      WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), ${interval})
        ${pFilterWpm}
      GROUP BY payload.event_name
      ORDER BY blocked_events DESC
      LIMIT 15
    `,

    // 8. WPM blocked by surface
    wpmBySurface: `
      SELECT
        payload.surface,
        COUNT(*) AS blocked_events,
        COUNT(DISTINCT payload.shop_id) AS unique_shops
      FROM \`sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_blocked_1\`
      WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), ${interval})
        AND payload.surface IN ('storefront-renderer', 'checkout-one', 'customer-account', 'shopify')
        ${pFilterWpm}
      GROUP BY payload.surface
      ORDER BY blocked_events DESC
    `,

    // 9. WPM emitted events per partner (for % blocked calc)
    wpmEmittedByPartner: `
      SELECT
        payload.pixel_app_id AS api_client_id,
        COUNT(*) AS emitted_events
      FROM \`sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_emit_4\`
      WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), ${interval})
        AND payload.pixel_app_id IN (${idList})
      GROUP BY payload.pixel_app_id
      ORDER BY emitted_events DESC
    `,

    // 10. WPM blocked per partner (matching emit window)
    wpmBlockedByPartnerForPct: `
      SELECT
        payload.api_client_id,
        COUNT(*) AS blocked_events
      FROM \`sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_blocked_1\`
      WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), ${interval})
        AND payload.api_client_id IS NOT NULL
        AND SAFE_CAST(payload.api_client_id AS INT64) IS NOT NULL
        AND payload.api_client_id IN (${idList})
      GROUP BY payload.api_client_id
      ORDER BY blocked_events DESC
    `,
  };
}
