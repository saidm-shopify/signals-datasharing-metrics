# Data Sharing Dashboard

Blocked event analytics for Web Pixels Manager & Server Pixels.

**Live**: https://signals-datasharing-metrics.quick.shopify.io/

## Data Sources

| Table | Purpose |
|-------|---------|
| `sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_blocked_1` | WPM blocked events |
| `sdp-ingest.monorail.monorail_server_pixel_data_sharing_observability_1` | SP blocked events |
| `sdp-ingest.monorail.monorail_web_pixels_manager_subscriber_event_emit_4` | WPM emitted events (for % blocked) |

## Deploy

```
quick deploy . signals-datasharing-metrics
```
