# Luma Hub

A mobile-first multi-service marketplace foundation for discovering thoughtful products, independent services, and future business offerings. Luma is intentionally structured as an extensible application rather than a static marketing site.

## Why this stack?

- **Next.js 15 + React 19 + TypeScript** provide a stable, type-safe, SEO-friendly application foundation with file-based routes, server rendering, and a natural API boundary.
- **Tailwind CSS** provides a small, consistent design system without locking the product into a large component framework.
- **Capacitor 7** keeps the web app ready to become Android and iOS apps when native projects are added.
- **PWA primitives** (manifest, service worker, offline route, and icons) make the browser app installable today.
- The modular `lib/data` repository layer can be replaced by a database-backed service without rewriting UI components.

## Technology

Next.js App Router, TypeScript, React, Tailwind CSS, ESLint, Capacitor, and a hand-authored service worker. No API keys or secrets are committed.

## Project structure

```text
app/                 Route pages, metadata, API health route, and offline screen
components/layout/   Responsive shell navigation and footer
components/ui/       Reusable primitives and icons
components/features/ Reusable feature components (search, listing, auth, PWA)
lib/data/            Replaceable sample catalog data layer
services/            Reserved for future API/database service implementations
types/               Shared domain types
public/              Manifest, icons, and service worker
```

## Getting started

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The supplied environment variables are placeholders for future database and authentication providers; do not expose secrets through `NEXT_PUBLIC_` variables.

## Quality checks and production

```bash
npm run lint
npm run typecheck
npm run build
npm run start
```

`npm run build` uses static export (`out/`), which is suitable for Capacitor. The current `app/api/health` route is available in development server mode; move health checks to an external/server deployment if static hosting is used.

## PWA

Run a production build and serve it using a static server or deploy the `out/` directory over HTTPS. Visit the site once online, then use the browser install prompt/menu. The service worker caches the app shell and visited same-origin GET resources and returns `/offline` for unavailable navigations. Use Chrome DevTools → Application → Service Workers/Manifest to validate installability and simulate offline behavior.

## Capacitor: Android and iOS

The Capacitor configuration points to the generated `out/` directory.

```bash
npm run cap:sync
npx cap add android
npx cap add ios
npm run cap:sync
npm run cap:android
npm run cap:ios
```

After opening Android Studio, select **Build → Generate Signed Bundle / APK**:

- Choose **APK** for a directly installable Android artifact.
- Choose **Android App Bundle** for the Play Store `.aab` artifact.

For iOS, open the generated project in Xcode, configure signing, and archive the app. Native platform folders are intentionally ignored by Git until the owning team decides to commit generated platform projects.

## Future architecture recommendations

1. Replace `lib/data/catalog.ts` with repository interfaces backed by Postgres/Prisma or a managed data service.
2. Add an auth provider behind a dedicated `services/auth` boundary and protect `/dashboard` with middleware.
3. Add a transactional search service and product/service detail routes.
4. Send contact and newsletter submissions to a validated server endpoint with rate limiting.
5. Add analytics, error monitoring, image optimization/CDN, and CI checks before public launch.
