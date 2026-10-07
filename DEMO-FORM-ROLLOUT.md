# Demo form review and rollout

Development branch: `dev/request-demo`. This change does not merge or deploy production.

## Implementation

- Static `request-demo.html` is discoverable by Netlify Forms. Form name: `demo-request`.
- Five required contact fields, optional DMS, optional multiple interests, and a hidden honeypot. No credentials or backend.
- Shared desktop/mobile navigation and all SEE IT IN ACTION links lead to the form. Contact and Dave's direct details remain available.
- Existing titles, descriptions, canonical links, structured data, and GA4 installation on existing pages are retained. New page has its own metadata and sitemap entry.
- JavaScript POST uses URL-encoded form data. Only a non-redirected HTTP 200 acknowledgement shows the requested thank-you and emits `demo_request`. Failures retain entries and offer retry/direct contact. The event includes no submitted personal details. Duplicate submissions are blocked while pending and after acceptance.
- Without JavaScript, native POST uses Netlify's default confirmation. The analytics event is not emitted in that fallback.

## Netlify configuration required before rollout

1. Verify the connected Netlify site's production branch is `main`. Do not configure this development branch as production. Review local screenshots first; any deploy preview or branch deployment requires a separate authorized deployment.
2. In the existing Netlify project, enable Forms detection before an approved deployment. After that deployment, verify `demo-request` appears in Forms.
3. Under the project's form submission notifications, add an email notification for `demo-request` to **info@powersystemsinc.ca**. This destination is a Netlify account setting; it cannot be configured by an HTML attribute. It has not been configured or verified by this repository change.
4. After an approved deployment, submit a clearly labeled test request. Confirm it appears in Netlify submissions and that the email arrives. Verify the successful-page GA4 event. Do not declare end-to-end readiness before these checks pass.
5. Keep Netlify submissions as the lead record. They can be exported for the Canadian Dealer Acquisition Engine; no credentials or acquisition integration are added here.

Netlify docs: https://docs.netlify.com/manage/forms/setup/ and https://docs.netlify.com/manage/forms/notifications/

## Validation

Run a local static server on port 4173, then `node .github/review/demo-review.cjs` with Playwright available. Optional `CHROME_BIN` selects an installed browser; `REVIEW_OUTPUT` sets the screenshots/report destination.

The browser checks cover 320–1440px widths, shared menu visibility, active navigation, images, overflow, required validation, HTTP/network errors, retry, duplicate guarding, encoded multi-interest payload, success event count, absence of personal data in analytics, blocked analytics, CTA destinations, and Contact preservation. Responses are mocked locally: these checks do not prove Netlify acceptance, retention, or email delivery.

Existing Contact CSP restricts scripts to self and blocks its pre-existing Google tag. That pre-existing limitation is unchanged; the demo page follows the functioning GA4 installation used on the other pages.
