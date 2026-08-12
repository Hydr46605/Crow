# Build And Release

## Scripts

| Command | Description |
| --- | --- |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm run typecheck` | Type-check without emitting. |
| `npm run dev` | Run with hot reload via `tsx`. |
| `npm start` | Run the compiled server. |
| `npm test` / `npm run test:run` | Run tests (watch / once). |
| `npm run test:coverage` | Run tests with coverage. |

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request to `main`, across Node 22 and 24:
typecheck → build → test.

## Releases

Releases follow [Semantic Versioning](https://semver.org) and
[Conventional Commits](https://www.conventionalcommits.org). `.github/workflows/release.yml`
supports two paths:

- **Manual**: trigger `workflow_dispatch` with a version. It bumps the version, generates the
  changelog from conventional commits, tags, and publishes.
- **Tag push**: pushing a `v*` tag runs the same pipeline.

Each release typechecks, builds, runs the tests, and creates a GitHub Release with the generated
changelog.

## Commit convention

- `feat: ...` adds a new capability (minor version).
- `fix: ...` fixes a bug (patch version).
- `BREAKING CHANGE:` in the footer bumps the major version.
