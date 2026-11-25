# Publish the user documentation

The public site is built from `website/` with VitePress. English is the default and Portuguese is under `/pt-BR/`. Existing technical notes in `docs/` are not automatically published. The site uses the project's existing logo and illustrative screenshot.

## First activation

The files and workflow can be reviewed locally before changing repository settings. To preview from the repository root:

```bash
npm --prefix website ci
npm --prefix website run dev
```

Open the local address printed by VitePress, including `/TinkerCraft/`.

When ready to publish:

1. Open the [TinkerCraft repository settings](https://github.com/Henriquex25/TinkerCraft/settings/pages) with a maintainer account.
2. Under **Pages → Build and deployment**, choose **GitHub Actions** as the **Source**. There is no branch or `/docs` directory to select for this workflow. Keep the existing application release settings unchanged.
3. Commit and push the reviewed website changes to `main` using your normal contribution flow. This starts the **Documentation** workflow. Application CI still runs according to its existing policy.
4. In **Actions → Documentation**, wait for **Build documentation** and **Publish documentation** to finish. If the `github-pages` environment requires approval, review and approve that deployment in GitHub.
5. Open the published address:

   ```text
   https://henriquex25.github.io/TinkerCraft/
   ```

   Check the English guide, switch to Portuguese, open a deep link, and try search. The Portuguese home is `https://henriquex25.github.io/TinkerCraft/pt-BR/`.

If the workflow's commit is already on `main` when you enable Pages, use **Actions → Documentation → Run workflow → main**. Do not run the desktop release workflow for a documentation update.

This session prepares and tests the site locally; it does not commit, push, enable Pages, or publish on behalf of the maintainer.

## Future updates

Change Markdown under `website/guide/` and its counterpart under `website/pt-BR/guide/`. Preview or build locally, commit, and push/merge to `main`. The website updates independently of `.deb` releases. Do not bump VERSION for documentation-only changes.

The workflow also watches the shared logo files and `docs/images/workspace.png`. Website dependency changes use `website/package.json` and `website/package-lock.json`; they must not modify the desktop frontend's dependency tree. Dependabot has its own group for this directory.

Pull requests build and audit but cannot publish. The deploy job only runs from `main`, requires the successful documentation build, and receives Pages/OIDC write permissions. No `pull_request_target`, personal access token, or app secret is needed. GitHub Actions publish only `website/.vitepress/dist`.

## Common setup failures

- **Pages not found / configure-pages returns 404:** confirm the repository is public, Pages is available, and the Source is GitHub Actions. Rerun the Documentation workflow after saving.
- **Deployment waiting:** inspect the `github-pages` environment's protection/approval settings.
- **Assets or links return 404:** retain the exact `/TinkerCraft/` base path, including capitalization. A repository rename or custom domain needs corresponding site configuration updates.
- **Build reports a dead link:** correct the Markdown route in both languages; do not disable dead-link checking.
- **Dependency audit fails:** update/review the website lockfile and the documented Vite override. Do not disable the audit or loosen the app's CI/release requirements.

## Official references

- [Custom GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
- [VitePress deployment](https://vitepress.dev/guide/deploy).
- [VitePress local search](https://vitepress.dev/reference/default-theme-search).
- [VitePress internationalization](https://vitepress.dev/guide/i18n).
