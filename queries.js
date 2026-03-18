// ─── Query Builder ───
// All queries use complete calendar days (excludes current partial day)

const KNOWN_PARTNERS = [
  { id: '3977633', name: 'Attentive' },
  { id: '5829751', name: 'Criteo' },
  { id: '2329312', name: 'Facebook & Instagram' },
  { id: '1780363', name: 'Google & YouTube' },
  { id: '32196493313', name: 'HubSpot' },
  { id: '123074', name: 'Klaviyo' },
  { id: '2585307', name: 'Mailchimp' },
  { id: '2997493', name: 'Microsoft Bing' },
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

function buildQueries(days, selectedPartnerIds, activeShopsOnly = false) {
  const isAll = selectedPartnerIds.length === KNOWN_PARTNERS.length;
  const idList = partnerIdsToSql(selectedPartnerIds);

  // Complete calendar days: e.g. days=1 → yesterday only, days=7 → last 7 full days
  // Excludes today's partial data to avoid misleading daily rates
  const dateRange = `DATE(event_timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
        AND DATE(event_timestamp) < CURRENT_DATE()`;

  // Active shops subquery (opt-in for exec reporting accuracy)
  const activeShopFilter = activeShopsOnly
    ? `AND SAFE_CAST(payload.shop_id AS INT64) IN (
          SELECT shop_id FROM \`shopify-dw.accounts_and_administration.shop_billing_info_current\`
          WHERE is_active = TRUE
        )`
    : '';
  // SP version uses payload.shop_id directly (already INT64 after UNNEST context)
  const activeShopFilterSp = activeShopsOnly
    ? `AND SAFE_CAST(payload.shop_id AS INT64) IN (
          SELECT shop_id FROM \`shopify-dw.accounts_and_administration.shop_billing_info_current\`
          WHERE is_active = TRUE
        )`
    : '';

  // WPM filter: restrict to selected partners
  const pFilterWpm = isAll ? '' : `AND payload.api_client_id IN (${idList})`;
  // SP filter: restrict to selected partners (after UNNEST)
  const pFilterSp = isAll ? '' : `AND api_client_id IN (${idList})`;

  return {
    // 1. WPM totals
    wpmTotals: `
      SELECT
        COUNT(*) AS total_blocked_events,
        COUNT(DISTINCT payload.shop_id) AS unique_shops,
        COUNT(DISTINCT payload.api_client_id) AS unique_api_clients
      FROM \`sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_blocked_1\`
      WHERE ${dateRange}
        ${pFilterWpm}
        ${activeShopFilter}
    `,

    // 2. SP totals (deduplicated by event_id, DATA_SHARING feature only)
    spTotals: !isAll ? `
      SELECT
        COUNT(DISTINCT payload.event_id) AS total_blocked_events,
        COUNT(DISTINCT payload.shop_id) AS unique_shops
      FROM \`sdp-ingest.monorail.monorail_server_pixel_data_sharing_observability_1\`,
        UNNEST(payload.api_client_ids) AS api_client_id
      WHERE ${dateRange}
        AND payload.action = 'BLOCKED'
        AND payload.feature = 'DATA_SHARING'
        ${pFilterSp}
        ${activeShopFilterSp}
    ` : `
      SELECT
        COUNT(DISTINCT payload.event_id) AS total_blocked_events,
        COUNT(DISTINCT payload.shop_id) AS unique_shops
      FROM \`sdp-ingest.monorail.monorail_server_pixel_data_sharing_observability_1\`
      WHERE ${dateRange}
        AND payload.action = 'BLOCKED'
        AND payload.feature = 'DATA_SHARING'
        ${activeShopFilterSp}
    `,

    // 3. WPM by partner
    wpmByPartner: `
      SELECT
        payload.api_client_id,
        COUNT(*) AS blocked_events,
        COUNT(DISTINCT payload.shop_id) AS unique_shops,
        COUNT(DISTINCT DATE(event_timestamp)) AS active_days
      FROM \`sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_blocked_1\`
      WHERE ${dateRange}
        AND payload.api_client_id IS NOT NULL
        AND SAFE_CAST(payload.api_client_id AS INT64) IS NOT NULL
        ${pFilterWpm}
        ${activeShopFilter}
      GROUP BY payload.api_client_id
      ORDER BY blocked_events DESC
    `,

    // 4. SP by partner (deduplicated by event_id + api_client_id, DATA_SHARING only)
    spByPartner: `
      SELECT
        api_client_id,
        COUNT(DISTINCT payload.event_id) AS blocked_events
      FROM \`sdp-ingest.monorail.monorail_server_pixel_data_sharing_observability_1\`,
        UNNEST(payload.api_client_ids) AS api_client_id
      WHERE ${dateRange}
        AND payload.action = 'BLOCKED'
        AND payload.feature = 'DATA_SHARING'
        ${pFilterSp}
        ${activeShopFilterSp}
      GROUP BY api_client_id
      ORDER BY blocked_events DESC
    `,

    // 5. WPM daily trend
    wpmDailyTrend: `
      SELECT
        DATE(event_timestamp) AS day,
        COUNT(*) AS blocked_events
      FROM \`sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_blocked_1\`
      WHERE ${dateRange}
        ${pFilterWpm}
        ${activeShopFilter}
      GROUP BY day
      ORDER BY day
    `,

    // 6. SP daily trend (deduplicated by event_id, DATA_SHARING only)
    spDailyTrend: !isAll ? `
      SELECT
        DATE(event_timestamp) AS day,
        COUNT(DISTINCT payload.event_id) AS blocked_events
      FROM \`sdp-ingest.monorail.monorail_server_pixel_data_sharing_observability_1\`,
        UNNEST(payload.api_client_ids) AS api_client_id
      WHERE ${dateRange}
        AND payload.action = 'BLOCKED'
        AND payload.feature = 'DATA_SHARING'
        ${pFilterSp}
        ${activeShopFilterSp}
      GROUP BY day
      ORDER BY day
    ` : `
      SELECT
        DATE(event_timestamp) AS day,
        COUNT(DISTINCT payload.event_id) AS blocked_events
      FROM \`sdp-ingest.monorail.monorail_server_pixel_data_sharing_observability_1\`
      WHERE ${dateRange}
        AND payload.action = 'BLOCKED'
        AND payload.feature = 'DATA_SHARING'
        ${activeShopFilterSp}
      GROUP BY day
      ORDER BY day
    `,

    // 7. WPM blocked by event name
    wpmByEventName: `
      SELECT
        payload.event_name,
        COUNT(*) AS blocked_events
      FROM \`sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_blocked_1\`
      WHERE ${dateRange}
        ${pFilterWpm}
        ${activeShopFilter}
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
      WHERE ${dateRange}
        AND payload.surface IN ('storefront-renderer', 'checkout-one', 'customer-account', 'shopify')
        ${pFilterWpm}
        ${activeShopFilter}
      GROUP BY payload.surface
      ORDER BY blocked_events DESC
    `,

    // 9. WPM emitted events per partner (for % blocked calc)
    // Matches Chad's web_events CTE: SUCCESS only, deduplicated by event_id
    wpmEmittedByPartner: `
      SELECT
        payload.pixel_app_id AS api_client_id,
        COUNT(DISTINCT payload.event_id) AS emitted_events
      FROM \`sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_emit_4\`
      WHERE ${dateRange}
        AND payload.status = 'SUCCESS'
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
      WHERE ${dateRange}
        AND payload.api_client_id IS NOT NULL
        AND SAFE_CAST(payload.api_client_id AS INT64) IS NOT NULL
        AND payload.api_client_id IN (${idList})
        ${activeShopFilter}
      GROUP BY payload.api_client_id
      ORDER BY blocked_events DESC
    `,

    // 11. SP total delivered events per partner (for SP % blocked calc)
    // Uses server_pixel_customer_events (batch table, partitioned by DATE)
    // api_client_id is INT64 here, so use unquoted IDs; CAST to STRING for JS matching
    spDeliveredByPartner: `
      SELECT
        CAST(api_client_id AS STRING) AS api_client_id,
        COUNT(DISTINCT event_id) AS delivered_events
      FROM \`shopify-dw.buyer_activity.server_pixel_customer_events\`
      WHERE is_success = TRUE
        AND DATE(event_timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
        AND DATE(event_timestamp) < CURRENT_DATE()
        AND api_client_id IN (${selectedPartnerIds.join(', ')})
      GROUP BY 1
      ORDER BY delivered_events DESC
    `,
  };
}
