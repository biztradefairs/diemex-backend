# Visitor passes, Twilio and venue scanning

## Backend setup

Use the existing paid Twilio account, registered WhatsApp sender and Verify Service.
Copy the relevant variable names from visitor-messaging.env.example into the backend deployment environment.
The example contains no account credentials.

- Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID and TWILIO_WHATSAPP_FROM.
- Set TWILIO_WHATSAPP_PASS_CONTENT_SID to the HX SID of the approved visitor-pass template.
  TWILIO_WHATSAPP_CONTENT_SID remains a supported alias.
- Match TWILIO_WHATSAPP_PASS_VARIABLES to the actual approved placeholders.
  The default mapping is 1=name, 2=registrationNumber, 3=passUrl.
  Available fields also include publicCode, mediaUrl, eventName, eventDates and venue.
  Use publicCode for a template URL button with a fixed /passes/view/ prefix.
  For a Cloudinary badge image, use a media URL of
  https://res.cloudinary.com/<cloud-name>/image/upload/{{3}} and set
  TWILIO_WHATSAPP_PASS_VARIABLES={"1":"name","2":"registrationNumber","3":"mediaPath"}.
  mediaPath is the image URL suffix after /image/upload/, including its version, folders and extension.
  Do not append .png to the template URL because mediaPath already contains it.
  Define sample values for all three placeholders, including a publicly accessible PNG path for 3.
  The old diemex_visitor_pass_2027 template was rejected because sample variable 3 was missing;
  use the corrected diemex_visitor_pass_2027_v2 template after WhatsApp approval.
  Cloudinary must be configured for a public badge image URL. Missing images fail before sending.
- Set TWILIO_SMS_MESSAGING_SERVICE_SID or TWILIO_SMS_FROM for ordinary SMS pass notifications.
  TWILIO_PHONE_NUMBER remains a legacy sender fallback.
  Verify OTPs use the configured Verify Service and do not require this sender.
- Set FRONTEND_URL to the public HTTPS website origin.
- Production rejects missing providers. Development without provider settings reports simulated delivery.
- Verify code length is read from the Twilio service and cached for five minutes.

Twilio template documentation:
https://www.twilio.com/docs/content/send-templates-created-with-the-content-template-builder

## WhatsApp badge artwork

WhatsApp deliveries attach a full 900 x 1428 portrait PNG instead of a standalone QR image.
The badge includes the bundled DIEMEX logo, event dates and venue, visitor name, company,
registration number, a QR and a VISITOR footer. The artwork follows the supplied reference:
a white portrait badge with centred logo, bold uppercase name, company, a flat blue top band
and V-shaped blue lower section with DIEMEX red accent stripes. The WhatsApp message text and approved
media template stay the same; template variable 3 still receives the Cloudinary mediaPath.
Existing passes get the new artwork when resent after deploying this backend.

VisitorBadgeRenderer draws the badge locally using @napi-rs/canvas. The original QR payload
is preserved, with integer-sized modules and a four-module white margin for scanning.
Names and companies wrap and shrink within fixed areas; unusually long text is shortened
visually while the saved visitor details and QR payload remain intact.

Upload uses visitor-passes/badge-<registrationNumber>.png, distinct from the old qr- assets.
Rendering or upload errors are reported as a failed delivery and keep the registration for retry.
Deploy package.json, package-lock.json and src/assets/badge together, then install production
dependencies with npm ci. The renderer loads its native dependency only when needed. Bundled
Inter font and logo assets avoid network or system-font dependencies at rendering time;
the font license and asset sources are included in src/assets/badge.

Generate an offline design preview from the backend directory:

    npm run preview:badge

The output is docs/previews/visitor-badge.png. Its QR is marked as a design preview and is
not valid for entry. The website badge card and email attachment keep their existing layouts.

## Verify OTP configuration

The current Verify Service SID and six-digit code length are recorded in ../twilio/verify.json.
Set TWILIO_VERIFY_SERVICE_SID in Render to the service SID in that file, then save and redeploy.
The previous VA0446bf47d5acd5369dc2ab300f89e2ce SID does not exist in the configured Twilio account.
The registered WhatsApp sender is +919880585504; set TWILIO_WHATSAPP_FROM=whatsapp:+919880585504.
Local .env changes are not copied to Render because .env is intentionally excluded from Git.

For WhatsApp OTP delivery, the Verify service uses the DIEMEX Verify WhatsApp Messaging Service.
The registered WhatsApp sender is assigned to that Messaging Service. Leave Verify's optional
Whatsapp.From override empty (null), so Verify selects the sender from the Messaging Service.
On 26 October 2026, the explicit override caused the Console enablement save to fail with
Invalid parameter: Whatsapp.From. Clearing only that override allowed the channel to be saved
and remain enabled after reloading. Keep the backend TWILIO_WHATSAPP_FROM=whatsapp:+919880585504
for visitor-badge messages; it is separate from the Verify service override.
The Messaging Service retains the sender's incoming-message webhooks.
Verify OTPs use authentication templates managed by Verify; the visitor-pass media template is separate.
A successful service configuration check does not confirm real OTP delivery.

## SMS visitor-pass delivery

Verify SMS OTPs and ordinary visitor-pass SMS messages use separate sender configurations.
The Verify service can send OTPs even when the account has no SMS sender for visitor passes.

- Set FRONTEND_URL=https://www.diemex.in in the backend deployment so the badge link is public.
  Without an explicit FRONTEND_URL, pass links default to that public origin.
  Local development may override it with a localhost origin.
- Set TWILIO_SMS_MESSAGING_SERVICE_SID to a dedicated SMS Messaging Service whose sender pool
  contains your Twilio-approved SMS sender. Do not use the WhatsApp-only Verify Messaging Service.
- Alternatively, set TWILIO_SMS_FROM to the approved alphanumeric sender or SMS-capable Twilio number.
  TWILIO_PHONE_NUMBER remains a legacy fallback. A configured SMS Messaging Service takes precedence.
- For the India domestic route, complete Twilio onboarding for the existing DLT Principal Entity,
  sender/header and approved visitor-pass message template. Match the approved text and variables;
  do not assume a WhatsApp registration or an OTP template approves visitor-pass SMS messages.
- SMS delivers the full HTTPS /passes/view/<publicCode> link. The visitor opens it to view/download the QR badge.
  Check provider delivery status after a real consented test; an accepted request alone is not proof of delivery.

The current account has no SMS-capable Twilio number or SMS sender in its existing Messaging Service.
The old configured numeric sender must be replaced before visitor-pass SMS can be considered ready.
DLT sender/template details and provider approval remain required for the domestic route.

India SMS guidelines: https://www.twilio.com/en-us/guidelines/in/sms

## Twilio WhatsApp sender endpoints

The registered sender uses the Twilio Functions service diemex-whatsapp-webhooks.
Its live URLs and resource identifiers are recorded in ../twilio/endpoints.json.
All three functions use protected visibility, so Twilio validates request signatures.
The source is in ../twilio/functions and the runtime is Node.js 22.

- Incoming messages: POST /whatsapp/incoming returns empty TwiML and records message metadata.
- Fallback: POST /whatsapp/fallback acknowledges the request and records its error code.
- Delivery status: POST /whatsapp/status records the message SID, status and error code in Twilio logs.

WhatsApp status callbacks always use POST; Twilio may return an empty status_callback_method field.

These handlers send no automatic reply and do not store message bodies or phone numbers in function logs.
Delivery callbacks are recorded in Twilio; they do not update visitor_passes.sentStatus in the CRM database.
This setup runs in Twilio and does not depend on a Render backend deployment.
The visitor-pass template diemex_visitor_pass_2027_v2 is approved for WhatsApp, verified on 26 October 2026.

## Registration and older passes

The dedicated /passes/register flow verifies the selected SMS/WhatsApp number before issuing a digital pass.
The main /register?t=visitor form currently uses background registration and email confirmation; it does not
request a phone OTP or trigger the WhatsApp pass flow. CMS submission and branded email remain supported.
Existing contact registration clients without an OTP token continue to issue email passes; they cannot trigger
SMS/WhatsApp delivery through this path.

Both registration paths write visitor_passes. The scanner accepts registration numbers, digital pass URLs,
multiline Code payloads and old /api/contact/pass/diemex-... email URLs.
For older passes, the scanner imports a canonical pass only when a matching visitor/delegate registration
exists in contact_submissions. Repeated scans reuse that pass. No bulk database rewrite is needed.
Legacy registration records need a valid stored mobile number to be imported.

## Staff access and attendance

Open /scanner over HTTPS and sign in using an active admin or editor account.
The existing admin login returns staff to /scanner. Viewer and exhibitor accounts cannot record scans.
Both the current and legacy scanner APIs require staff authentication.

Repeat visits remain allowed. The same browser/pass combination has a 15-second duplicate cooldown.
Different browsers may record separate visits during that window.
The database transaction locks the pass row while checking and inserting a scan.
First entry sets checkedInAt and status=checked_in; later visits append history without resetting first entry.
Cancelled passes are rejected. No event-date restriction or offline queue is introduced.

OTP and pre-registration verification sessions remain in server memory. A server restart clears them;
multi-instance deployment requires a shared session store before scaling this part of the application.

## Validation

Run from diemex-backend:
node node_modules/jest/bin/jest.js --runInBand --no-cache --coverage=false tests/passMessaging.test.js tests/passes.test.js tests/visitorBadge.test.js

Run from dimex:
node node_modules/typescript/bin/tsc --noEmit --incremental false

The pass regression suite mocks Twilio, email, Cloudinary and database models. The badge suite renders real PNGs and decodes the full image at original and phone-sized resolutions.
Before production use, verify a real OTP, the approved WhatsApp pass template, an HTTPS mobile camera scan,
a saved attendance row, a repeat visit and rejection of a cancelled pass against the deployment database.

### Live validation on 26 October 2026

The Indian WhatsApp test recipient received and verified a real six-digit Verify OTP through the deployed
/api/passes endpoints. The existing registration was reused, and the application's badge message was
confirmed read by Twilio with one PNG attachment and no delivery error. The attachment decoded to the
saved pass QR payload; the public pass API and badge page both returned HTTP 200. A separate labelled
test QR message was also received, and the recipient confirmed that its image opened correctly.
No new registration or attendance scan was created during the live test. Other countries were not tested.
The 41 pass/messaging regression tests and the frontend TypeScript check passed.
