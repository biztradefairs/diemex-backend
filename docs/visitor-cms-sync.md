# Visitor passes in CMS

The browser submits to the DIEMEX pass API. DIEMEX stores and delivers the pass, writes a durable CMS sync record, and synchronizes it to the CMS backend. CMS shows it under Marketing ? Leads ? Visitor, including the badge in lead details. Assigned sales users can see the same badge details.

## Configuration

Set the same private `CMS_SYNC_SECRET` in the DIEMEX backend and CMS backend environments. Never use a NEXT_PUBLIC variable for this secret.

DIEMEX backend also needs:
- `CMS_GRAPHQL_ENDPOINT` (the existing NEXT_PUBLIC_CMS_GRAPHQL_ENDPOINT is supported)
- `CMS_PROJECT_ID` (the existing NEXT_PUBLIC_CMS_PROJECT_ID is supported)
- `PUBLIC_BACKEND_URL` or `BACKEND_URL`: publicly reachable DIEMEX API origin, used for badge images
- `FRONTEND_URL`: DIEMEX website origin, used for pass links

For local development the backend origin is usually http://localhost:5000. Set CMS_GRAPHQL_ENDPOINT to the actual local CMS GraphQL URL when testing locally.

## Deployment

1. In cms-backend, run `npx prisma migrate deploy`, `npx prisma generate`, then build and restart the CMS backend with CMS_SYNC_SECRET set.
2. Deploy the CMS frontend with its regenerated GraphQL documents.
3. Deploy/restart the DIEMEX backend with matching configuration.
4. Deploy the DIEMEX frontend registration changes.

The new CMS migration only adds visitor pass storage. The DIEMEX backend creates its new visitor_pass_cms_sync queue table without altering the visitor_passes table.

## Recovery and existing registrations

The worker runs every 30 seconds. It discovers existing passes without sync records and sends pending records in bounded batches. Failed requests remain pending with exponential retry delays. A pass registration remains successful when CMS is unavailable.

Each pass is matched by project and external pass ID. Retrying updates that pass instead of creating another lead. Existing visitor leads with the same email or phone can be linked on first sync. Later badge updates do not overwrite CMS lead status, assignment, notes, or contact edits.

Delivery and check-in events queue updated snapshots. Older snapshots cannot replace newer data. A snapshot changed while its network request was running stays pending.

To inspect synchronization, query visitor_pass_cms_sync in the DIEMEX database. status, attempts, lastError, nextAttemptAt, and syncedAt show progress. No OTP or verification token is sent to CMS.

In the CMS, open the DIEMEX project, choose Marketing ? Leads, filter Lead Type to Visitor, then open a visitor. The Visitor Pass & Badge section includes visitor address and interests, registration/public codes, badge design, issue/verification/check-in times, delivery channel/status, badge preview, and links to view or download the badge.
