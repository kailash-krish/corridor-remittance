# Corridor

An AED-to-INR remittance prototype, built from the supplied Next.js frontend and Express backend. The working project lives here, separately from the original GDGOC folders.

Live demo: https://corridor-remittance.vercel.app

Source repository: https://github.com/kailash-krish/corridor-remittance

## Run locally

Use Node.js 24 LTS. From this folder:

```sh
npm run setup
npm run dev
```

Open http://127.0.0.1:3100. The backend listens on port 4100. Use this exact frontend origin because session requests are origin-checked. Stop any existing preview on those ports before starting another instance.

The setup command installs the three packages and creates matching random local JWT secrets only when configuration files are missing. It does not overwrite existing environment files. These files are ignored by Git.

For a production build of the local prototype:

```sh
npm run build
npm start --prefix backend
# In another terminal:
npm start --prefix frontend
```

This is still a demo, even when using the optimized build. It does not implement production customer registration, email/password login, real fiat transfers, or a licensed financial service.

## What changed

- Retained the supplied Next.js App Router, React, TypeScript, Tailwind, icon library, and component foundation. The original invoice routes are preserved in `frontend/original-app` outside the active application, and original reusable components remain in `frontend/src`.
- Added a complete remittance landing page and workspace with ivory, forest green, and ink colors, locally hosted Outfit typography, rectangular controls, and specific corridor language.
- Built a Three.js globe using Natural Earth outlines from `world-atlas`, route markers, a moving transfer indicator, and pointer-responsive orientation. No Spline embed or external runtime assets are required.
- Added GSAP entry animation, scroll reveals, a pinned desktop introduction, stacked process panels, mobile layouts, reduced-motion support, and a WebGL fallback.
- Added a responsive quote/recipient/review flow, demo identity checks, backend transfer history, cancellation, deposit simulation, status refresh, audit events, and expiry handling.
- Replaced the original mock login route with explicitly labeled, signed demo sessions stored in an HTTP-only cookie. The API proxy forwards the user's token, restricts route access, and validates mutation origins.
- Added privacy and terms pages specific to the actual prototype. Operator identity/contact details and deployment-specific review remain necessary before a public launch.
- Created a separate MCP package using the official SDK.

## Walk through the demo

1. Open the homepage and try the illustrative calculator.
2. Select **Try a transfer**, enter a fictional display name, and start a demo session.
3. Open **Your identity**. Use a fictional name and test ID such as `DEMO123456`.
4. Open **Send money**, request an AED quote, enter a fictional recipient and UPI ID, and review.
5. Quotes expire after 60 seconds. Refresh an expired quote before confirming.
6. Confirm the demo transfer, then select **Simulate deposit**.
7. Inspect the resulting event timeline and transfer history.

Test identity IDs ending in `0000` are rejected. IDs ending in `9999` require review. High-value transactions can enter the backend's AML review path and will stay on hold pending an administrator decision.

The chain service used by the supplied core backend is a stub. The complete supplied `backend/chain-service` contracts and wallet code are preserved, but connecting them to a real local chain is separate from the default UI demo. The frontend labels hashes as simulated references and does not link them to a public explorer.

## MCP server

```sh
CORRIDOR_API_URL=http://127.0.0.1:4100 \
CORRIDOR_ACCESS_TOKEN='<authenticated-user-jwt>' \
node mcp/server.mjs
```

The server uses stdio. `mcp/config.example.json` contains a client configuration template. Replace the absolute path and provide a user-scoped JWT issued for this backend. Do not use the signing secret as an access token. This server has been created and tested locally; it is not automatically registered in any desktop client's global configuration.

Tools:

| Tool | Behavior |
| --- | --- |
| `service_health` | Check API health |
| `create_quote` | Create a 60-second simulated AED-to-INR quote using integer fils |
| `list_transfers` | Read transfers owned by the token's user |
| `get_transfer` | Read an owned transfer and its events |
| `identity_status` | Read status without exposing identity fields |

A `corridor://scope` resource explains the simulation. The server intentionally does not expose fund movement, AML approval, or identity changes. Backend authorization applies to every protected request.

Implementation references: [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server), [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [Natural Earth data](https://github.com/topojson/world-atlas). Geography data is used for an illustrative route visualization, not geographic navigation.

## Verification

```sh
npm test
npm run build
# With frontend and backend running:
npm run test:integration
```

Verified on 7 October 2026:

- Frontend production build and strict TypeScript checks pass.
- Backend build passes; all 43 tests across 11 files pass.
- MCP discovery, authentication forwarding, amount validation, quote mapping, resource discovery, and identity-field filtering pass.
- Integration checks pass for all five pages, session origin protection, route allowlist, three KYC outcomes, quotes, idempotent creation, cancellation, deposit-to-payout, event history, ownership isolation, and logout.
- Backend test runner upgraded to a patched version. Unused legacy ESLint dependencies removed; `lint` runs the TypeScript check. Installed frontend, backend, and MCP packages reported zero known npm audit vulnerabilities after changes. The separately preserved chain-service package was not installed or audited in this task.

The deployed homepage was opened and inspected in Firefox. Full desktop/mobile interaction and motion coverage is not automated. Earlier localhost browser checks were unavailable because the browser tool could not verify its administrator-enforced security policy.

## File map

- `frontend/src/components/remittance/landing.tsx`: homepage and motion
- `frontend/src/components/remittance/globe.tsx`: 3D rendering and geographic route
- `frontend/src/components/remittance/workspace.tsx`: transfer workspace
- `frontend/src/components/remittance/legal.tsx`: privacy and terms content
- `frontend/src/app/globals.css`: responsive visual system
- `frontend/src/app/api`: session and backend proxy routes
- `backend`: copied backend and blockchain source
- `mcp`: MCP implementation, configuration example, and tests
- `tests/integration.mjs`: local integration checks
- `.agents/skills/gpt-taste`: installed design skill

## Interaction and SEO refinement

The second design pass adds an original interactive token-and-orbit sculpture on the homepage, login, and transfer receipt. Drag it horizontally or use arrow keys when focused. Home resets the rotation. Pause and reset controls are available beside each model. Offscreen scenes skip rendering, pixel ratio is capped, and reduced-motion preferences disable automatic movement.

A pinned desktop story follows AED, RMTS test tokens, and INR as the visitor scrolls. Its three controls also select the stages directly. Small screens and reduced-motion users get the unpinned, manually controlled version. The login now has an editorial split layout, and the sending screen has amount presets, navigable steps, an expiry ring, a 3D quote receipt, and animated transitions.

Five FAQs are supplied from one shared data file. Added resources include a custom SVG/ICO favicon and Apple icon, breadcrumbs, distinct titles and descriptions, a social preview image, `robots.txt`, and `sitemap.xml`. The custom missing-page screen returns HTTP 404 only for missing routes. A separate error boundary handles unexpected application errors. Private routes carry `noindex`; robots exclusions are not a replacement for authorization.

Design references used as inspiration, with original implementation rather than copied components:

- [Watermelon UI animated components](https://ui.watermelon.sh/free/animated-react-components): stateful controls, feedback, and compact product interactions.
- [Magic Patterns](https://www.magicpatterns.com/teams/designers): consistent interactive form states within an existing visual identity.
- [Codrops creative demos](https://tympanus.net/codrops/hub/all/): scroll-driven Three.js scenes and spatial transitions.

### Google Analytics configuration

No measurement ID was supplied, so tracking remains inactive. Add your values to `frontend/.env.local` and rebuild or restart the development server:

```dotenv
NEXT_PUBLIC_SITE_URL=https://your-actual-domain.example
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-YOURREALID
```

The example domain and ID above are placeholders, not a deployment or an Analytics property. On Vercel, the canonical URL defaults to the project production domain. Local runs default to the preview address.

The implementation follows [Google's consent guidance](https://developers.google.com/tag-platform/security/guides/consent). It loads the Google tag only after affirmative analytics consent on an allowlisted public page. Analytics preferences can be changed on the privacy page. Advertising storage, advertising user data, personalization, and Google signals are disabled. Page-view payloads use fixed titles, sanitized locations without query strings or fragments, and an empty referrer. Public-to-private links use full document navigation so the Google tag does not carry into the login or workspace.

In the GA4 web stream, turn off Enhanced Measurement automatic page views/history events and form interactions. This integration sends its own public-page views; automatic events would be redundant. Configure retention in your Google Analytics property and update the privacy notice for your actual operator and deployment. Actual receipt of events in GA4 remains unverified until a real property ID is provided and consented events are checked there.

Additional checks:

```sh
npm run test:pages
npm run test:analytics
```

The page checks verify unique titles and descriptions, five FAQs, server-rendered breadcrumbs, HTTP 404 behavior, noindex, robots exclusions, sitemap contents, icon formats, the social preview, and no active Analytics script in the unconfigured build. Three analytics-policy tests verify consent gating, private-route exclusions, and removal of personal URL fields. These checks and the existing transfer integration checks passed after this pass. The deployed homepage was subsequently inspected in Firefox.

## Hosted demo on Vercel

Public URL: https://corridor-remittance.vercel.app

Project: `corridor-remittance`, in `kailash-krishs-projects`. The Next.js application runs the original Express demo core inside its API functions. Each signed visitor session has an isolated snapshot in the private `corridor-demo-sessions` Vercel Blob store in Mumbai (`bom1`). The hosted demo does not depend on this laptop.

State writes use ETags and conditional updates, retrying concurrent changes. Storage failures return an error instead of silently using temporary memory. A session is limited to 50 quotes and 20 transfers. Sessions expire after eight hours; signing out does not delete the private snapshot. There is no scheduled snapshot deletion yet. Only fictional identity and recipient details should be entered.

Production and preview require `DEMO_MODE=true`, `CORRIDOR_HOSTED=true`, a secret `DEMO_JWT_SECRET`, and the private Blob store connection. Do not copy local secrets into deployment files. The Vercel integration supplies storage credentials. Analytics remains inactive until a real GA4 measurement ID is supplied and the project is redeployed.

To refresh the compiled backend and deploy future changes:

```sh
npm run build
npm run test:hosted
git add .
git commit -m "Update Corridor"
git push origin main
```

For Git deployments, set the Vercel Root Directory to `frontend`, use Node.js 24, and keep the build command `npm run build`. The compiled backend in `frontend/server/core` is committed so this folder can build independently. After modifying backend source, always run the root `npm run build` and commit the synchronized core too.

Pushing `main` triggers a production deployment through the connected GitHub repository. For manual CLI deployment from a fresh checkout, run `npx vercel link` from the project root, select the existing project, and run `npx vercel deploy --prod`; Vercel uses its configured `frontend` Root Directory. `.vercelignore` excludes local environment files, dependencies, build output, and archived invoice routes. The older `deployment/corridor` staging folder is not the deployment source.

Hosted persistence tests cover the full simulated transfer flow, concurrent writes, visitor isolation, and storage failure. Live integration checks can use `TEST_ORIGIN=https://your-deployed-domain` with `npm run test:integration` and `npm run test:pages`.

Live verification passed on 7 October 2026: all five public/application pages, origin protection, authenticated session cookies, route restrictions, identity outcomes, quote validation, transfer idempotency, cancellation, simulated deposit-to-payout, saved audit events, visitor isolation, logout, metadata, 404 behavior, robots, sitemap, and image assets.

## Source ZIP

The release ZIP contains frontend, backend, optional blockchain contracts and chain service, MCP server, design skill, tests, lockfiles, and this guide. Dependencies, local credentials, Git/Vercel metadata, caches, and stale deployment staging are excluded. After extracting it, use `npm run setup` and `npm run dev`. The optional chain service has its own README and is not required for the hosted simulated demo.
