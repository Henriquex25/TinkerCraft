# TinkerCraft documentation website

Public user documentation built with VitePress and hosted on GitHub Pages. English is the default; Portuguese (Brazil) has matching routes under `pt-BR/`.

## Preview locally

From the repository root, with Node.js 22+:

```bash
npm --prefix website ci
npm --prefix website run dev
```

Open the URL printed by VitePress, including `/TinkerCraft/`. To preview the production build:

```bash
npm --prefix website run build
npm --prefix website run preview
```

The development server and production preview bind to loopback. Preview uses Vite directly against the VitePress output directory because the VitePress 1.x preview command does not honor its host flag. Restart the preview server after rebuilding; use the dev server for live editing. The desktop app does not need to be running. Website dependencies and its lockfile are separate from the app's frontend and root test dependencies.

## Content and assets

- `guide/`: English user guides.
- `pt-BR/guide/`: the same guides in Portuguese.
- `.vitepress/config.ts`: locales, navigation, search, metadata, and `/TinkerCraft/` base path.
- `.vitepress/theme/`: default VitePress theme with TinkerCraft colors.
- `scripts/prepare-assets.mjs`: copies the existing logo and example screenshot before dev/build.

Edit both languages when behavior changes. Keep instructions grounded in the app's current behavior. A guide can be corrected without changing the app's VERSION or producing a desktop release.

Images are generated from `build/appicon.png`, `build/appicon-small.png`, and `docs/images/workspace.png`; the copies in `public/` are ignored. This avoids creating a second source for the logo. The asset preparation step also includes the root MIT license and installed website dependency notices. Only files under this website are published. Technical notes under the repository's `docs/`, workspaces, downloaded tools, and `.env` are not part of the site.

## Build and dependency policy

VitePress 1.6.4 and Vite 6.4.5 are pinned. The generator uses the same patched Vite dependency through an override, supported by plugin-vue's Vite 6 peer range. The default stable VitePress dependency tree otherwise resolves vulnerable older development dependencies. Build, preview, search, and locale navigation must be checked when changing this override. Do not remove it merely to match an older transitive range.

```bash
npm --prefix website audit
npm --prefix website run build
```

The build checks Markdown links. Search uses a local browser index; it does not require Algolia credentials. The site has no added analytics or donation scripts.

## Publish

The workflow is `.github/workflows/docs.yml`. Pull requests build and audit with read permissions. Pushes to `main` affecting the website, its shared assets, or that workflow build and deploy through GitHub Pages. Manual dispatch deploys only when the selected branch is `main`.

The maintainer must enable **Settings → Pages → Build and deployment → Source: GitHub Actions** once. See [the setup guide](../docs/github-pages.md). No personal access token or additional repository secret is required. The configured address is:

```text
https://henriquex25.github.io/TinkerCraft/
```

Generated `.vitepress/dist`, `.vitepress/cache`, and `node_modules` stay out of Git. The website has no application version field: VERSION remains the only app-version source.
