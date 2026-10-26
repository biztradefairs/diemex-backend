# Visitor badge designs and file responsibilities

## Choosing a design

After deploying the backend and frontend, sign in as an admin and open **Badge Designs**
at `/admin/badge-designs`. Select **Design 1** or **Design 2**, then click **Use selected design**.
The selected design is saved in MySQL and survives backend restarts. Design 1 is the default
when no selection has been saved. Switching designs sends no messages by itself.
The next WhatsApp badge delivery or resend uses the selected layout and the existing visitor
record and QR payload. Previously delivered WhatsApp messages retain their attached image.

- **Design 1:** the existing white badge with blue top band, red accents and angled blue footer.
- **Design 2:** green layout in this exact order: logo, name, designation, company, country,
  centred QR, visitor ID, VISITOR. There is no profile photo, avatar, date line, venue or footer note.
  The provided DIEMEX logo retains its original artwork. The divider and band are green `#00A651`.
  All text, including VISITOR, and the QR use black `#000000`.

Both designs are 900 x 1428 PNGs. Design 2's **Visitor ID** displays `DMX-` followed by the last six digits of the registration number
(e.g. REG-DMX-28082026-750281 displays as **DMX-750281**). This is a display label only; the full
registration number and QR payload remain unchanged. Missing designation
or country values are omitted; details are never invented. The renderer fits long text into
fixed regions and leaves a white margin around the QR.

## Files that control the actual WhatsApp badge UI

Paths in this table are relative to `diemex-backend`.

| File | Responsibility |
| --- | --- |
| `src/services/badges/design1.js` | Design 1 layout: logo position, name/company, dates/venue, angled footer and VISITOR text. Edit only this file to change Design 1's arrangement. |
| `src/services/badges/design2.js` | Design 2 layout: green colours, logo, name/designation/company/country, centred QR, visitor ID and final VISITOR band. Edit this file to change Design 2's arrangement. |
| `src/services/badges/artwork.js` | Shared image dimensions, logo/font loading, text wrapping/shrinking, letter spacing and QR drawing. Default blue/red colours used by Design 1 live here; Design 2 declares its green palette in design2.js. |
| `src/services/VisitorBadgeRenderer.js` | Validates badge inputs, selects the requested design, creates the canvas and returns the final PNG buffer. It defaults to Design 1 when called without a design. |
| `src/services/badges/designs.js` | Allowed design IDs, display names/descriptions and default design. |
| `src/assets/badge/diemex-logo.png` | Logo embedded in the PNG. It is a bundled copy of the website's `public/images/diemex3.png`. |
| `src/assets/badge/Inter.ttf` | Bundled font so rendering does not depend on server-installed fonts. |
| `src/assets/badge/OFL.txt` | License for the bundled Inter font. |
| `src/assets/badge/README.md` | Logo/font provenance and asset notes. |

## Selection, visitor data, generation and sending

These paths are also relative to `diemex-backend`.

| File | Responsibility |
| --- | --- |
| `src/models/mysql/VisitorBadgeSetting.js` | MySQL model for the global selected design, updater and timestamps in visitor_badge_settings. |
| `src/services/VisitorBadgeSettingsService.js` | Reads/saves the selection, validates IDs and ensures the new settings table exists. It reads MySQL on each delivery rather than caching the selected design in process memory. |
| `src/models/index.js` | Registers VisitorBadgeSetting and the existing VisitorPass/VisitorPassScan models with Sequelize. |
| `src/models/mysql/VisitorPass.js` | Stores the actual visitor name, designation, company, country, registration number and QR payload. |
| `src/services/PassService.js` | Creates/reuses visitor records, defines event details, builds QR payloads, reads the selected design, calls the renderer, uploads its PNG and invokes WhatsApp delivery. Records delivery success/failure without losing the registration. |
| `src/services/CloudinaryService.js` | Uploads the PNG and returns its public HTTPS URL. Each design has its own `visitor-passes/badge-design1-<registrationNumber>` or `badge-design2-<registrationNumber>` asset path. |
| `src/services/PassMessagingService.js` | Sends the approved Twilio WhatsApp template and maps visitor fields and the image mediaPath to template variables. The WhatsApp text/template is unchanged. |
| `src/routes/passRoutes.js` | Registration/resend APIs plus authenticated admin GET/PUT `/api/passes/badge-design` and PNG preview GET `/api/passes/badge-designs/:design/preview`. Only active admins can read/change the design setting or request these sample previews. |
| `src/app.js` | Mounts passRoutes under `/api/passes`. |
| `src/services/VisitorBadgePreview.js` | Supplies safe example visitor data and an explicitly invalid-for-entry QR payload to render sample badges. It does not create registrations or send messages. |
| `scripts/preview-visitor-badge.js` | CLI for generating offline sample PNGs for one or both designs. |
| `docs/previews/visitor-badge-design1.png` | Generated Design 1 sample. |
| `docs/previews/visitor-badge-design2.png` | Generated Design 2 sample. |
| `docs/previews/visitor-badge.png` | Existing Design 1 preview path retained for earlier links. |
| `package.json` / `package-lock.json` | Renderer/QR dependencies and the preview:badge command. |
| `tests/visitorBadge.test.js` | Renders both layouts and checks PNG output, decoded QR data at original/phone sizes, long details and invalid inputs. |
| `tests/passes.test.js` | Checks access control, saved selection, switching in both directions, correct design passed to delivery and preservation of registrations on failures. |
| `tests/passMessaging.test.js` | Checks Twilio template variables, media paths and delivery configuration. |
| `docs/VISITOR_PASS_SETUP.md` | Provider configuration, deployment and validation notes. |
| `docs/visitor-messaging.env.example` | Names of messaging configuration variables; contains no credentials. |

The settings table is created with Sequelize sync without altering or deleting existing tables.
The database user must be allowed to create this table, or the deployment administrator must
create it from the VisitorBadgeSetting model before using the selector. A database/settings
failure is reported rather than falsely claiming a save or sending a badge in another design.

## Admin UI files

These paths are relative to the frontend repository `dimex`.

| File | Responsibility |
| --- | --- |
| `app/admin/badge-designs/page.tsx` | Displays both rendered previews, the active design, design selection, save state and errors. |
| `lib/api/badgeDesigns.ts` | Typed API functions for reading/saving the design and fetching protected preview PNGs. |
| `app/admin/AdminShell.tsx` | Adds the Badge Designs navigation item. |
| `lib/api.ts` | Shared API host and authentication-token interceptor used by the admin requests. |
| `app/admin/layout.tsx` / `hooks/useAuth.ts` | Existing admin login/session handling. The backend separately enforces admin permission. |
| `public/images/diemex3.png` | Original logo supplied for the badges; copy updated artwork into the backend bundled logo when replacing it. |

## Other existing badge/registration UI files

The new design selector controls **WhatsApp image attachments**. These existing website and
email generators have their own layouts and do not use this setting:

| Repository/file | Responsibility |
| --- | --- |
| `dimex/components/passes/VisitorPassCard.tsx` | Existing visitor badge card shown on the website. |
| `dimex/lib/downloadVisitorBadge.ts` | Existing browser canvas for badge downloads/data URLs/blobs. |
| `dimex/app/passes/view/[code]/page.tsx` | Loads a public visitor pass and displays/downloads the website card. |
| `dimex/app/passes/success/page.tsx` | Registration-success page, website card and download/resend/share controls. |
| `dimex/lib/api/passes.ts` | Visitor pass types, OTP/registration/resend/public-pass/scanner HTTP requests and session data. |
| `dimex/app/passes/register/page.tsx` | Collects visitor details and runs the selected WhatsApp/SMS/email OTP registration flow. |
| `dimex/components/passes/OtpModal.tsx` | OTP entry/verification UI. |
| `diemex-backend/src/routes/contact.js` | Existing contact-form registration/email path and legacy email QR attachment/download endpoint. |
| `diemex-backend/src/services/EmailService.js` | Sends existing HTML email and email attachments. |
| `diemex-backend/src/models/mysql/VisitorPassScan.js` | Stores entrance scan/check-in history; does not draw the badge. |
| `dimex/app/scanner/page.tsx` | Staff camera scanning and attendance UI; does not choose artwork. |

## Preview and checks

From `diemex-backend`:

    npm run preview:badge -- --all
    npm run preview:badge -- --design design2 docs/previews/my-badge.png
    node node_modules/jest/bin/jest.js --runInBand --coverage=false tests/visitorBadge.test.js tests/passes.test.js tests/passMessaging.test.js

From `dimex`:

    node node_modules/typescript/bin/tsc --noEmit --incremental false

The offline preview QR is a sample and is not valid for entry. Deploy both repositories before
using the admin switch on the live website. Local changes do not deploy automatically.
