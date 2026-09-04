# Ready, Set, Repro! Robot runner

GitHub Actions workflow [`.github/workflows/robot-repro.yml`](../.github/workflows/robot-repro.yml) runs a **newly generated, unmerged** Robot Framework file against **Staging only**. It does not deploy the app, does not touch Production, and does not run the existing `tests/robot/` regression suite unless those files are the ones changed in the PR.

Local Robot convention (from `tests/robot/resources/common.resource`):

```bash
python3 -m pip install -r tests/robot/requirements.txt
python3 -m robot --outputdir tests/robot/results tests/robot
```

Suites use **SeleniumLibrary** plus `tests/robot/libraries/PointsEngine.py`. They read `APP_PUBLIC_URL` (base URL), `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, and `ROBOT_HEADLESS` (default `true`). The CI job maps `STAGING_BASE_URL` → `APP_PUBLIC_URL` and uses that same `python3 -m robot --outputdir tests/robot/results …` command on the selected `.robot` file(s).

## How the `.robot` file is chosen

| Trigger | Checkout | Tests run |
|---------|----------|-----------|
| Pull request into `main` whose **head branch** starts with `ready-set-repro/` | Unmerged PR **head** commit (`pull_request.head.sha`), not `main` | `.robot` files **added, copied, modified, or renamed** in that PR vs the base SHA |
| `workflow_dispatch` | Input `test_ref` (branch or commit SHA) | Exactly the repository-relative path in `test_path` |

- Other PRs into `main` still *see* the workflow, but the Robot job is **skipped** unless the head branch has the `ready-set-repro/` prefix.
- If a matching PR has **no** changed `.robot` file, the job **fails** with a clear error.
- The workflow uses `pull_request` (not `pull_request_target`) and `contents: read` only.

## Required GitHub configuration

Set **`STAGING_BASE_URL`** to the Staging public URL (HTTPS):

1. Repo **Settings → Secrets and variables → Actions**
2. Either a **variable** or a **secret** named `STAGING_BASE_URL`

If both exist, the variable is used. If neither is set, the job fails before Robot runs and does not print credential values.

GitHub does not pass Actions secrets or variables to workflows from **fork** PRs. Repro Agent branches should live on this repository (`ready-set-repro/...`) so Staging configuration is available.

Optional secrets, matching the existing Robot env names:

- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PASSWORD`

If those secrets are unset, the suites use the same defaults as `common.resource` (`superadmin@points.local` / `superadmin123`). Do not store Production URLs or Production credentials in this workflow.

Staging must be reachable from GitHub-hosted runners. This runner never sets a Production base URL.

## Manual run (`workflow_dispatch`)

1. **Actions → Robot Repro (Staging) → Run workflow**
2. `test_ref`: Repro Agent branch (for example `ready-set-repro/JIRA-123`) or a commit SHA
3. `test_path`: repository-relative file, for example `tests/robot/repro_JIRA-123.robot`

Or:

```bash
gh workflow run robot-repro.yml \
  -f test_ref=ready-set-repro/JIRA-123 \
  -f test_path=tests/robot/repro_JIRA-123.robot
```

## Logs and screenshots

Whether Robot passes or fails, the job uploads an artifact named **`robot-repro-results`** (`if: always()`). The job itself stays **failed** when a Robot assertion fails.

In the workflow run: **Artifacts → robot-repro-results**. Typical files:

- `log.html` — keyword-level log
- `report.html` — summary report
- `output.xml` — machine-readable output
- `selenium-screenshot-*.png` and any video/trace files the suite wrote
