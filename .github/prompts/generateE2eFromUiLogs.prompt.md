---
name: generateE2eFromUiLogs
description: Create Playwright e2e tests from UI appendOutput logs.
argument-hint: Provide the selected UI code or file path, a mapping of appendOutput lines → user actions, and an optional test config path.
---
You are given a UI implementation where runtime messages are emitted to a single output sink (for example, an `appendOutput` function writing to `#output`). Your task is to generate a reproducible Playwright end-to-end test that performs the user actions which produce those output lines, verifies the output sequence, and prefers using real adapters/services when available.

Steps and requirements (follow exactly):

1. Inputs (replace placeholders):
   - `{{uiFileOrSelectedCode}}`: path or selected code that contains the UI and `appendOutput` usage.
   - `{{actionMap}}`: a list mapping UI actions (button clicks, prompts, form inputs) to exact `appendOutput` lines expected.
   - `{{configPath}}` (optional): path to test config (e.g., GitLab/GitHub mock or real endpoint) to use real adapters.
   - `{{storageFallback}}` (optional): a preferred storage fallback (e.g., IndexedDb) if OPFS is unavailable.
   - `{{pausePoint}}` (optional): a named step where `await page.pause()` should be inserted for interactive debugging.

2. Environment assumptions: list what must be running for the test to pass (examples: local examples server, mock Git service at `{{host}}`, `npm run start`). Make these explicit in the test file header comments.

3. Test structure and behavior:
   - Use Playwright TypeScript test runner and ESM imports.
   - Navigate to the running examples page .
    - If `{{configPath}}` is provided, read it from the filesystem at test runtime and set the UI inputs on the page instead of using URL params. For example:

       ```ts
       const repoUrl = `${cfg.host || ''}/${cfg.projectId}`.replace(/([^:])\/\//g, '$1/')
       const token = cfg.token
       await page.fill('#repoInput', repoUrl)
       await page.fill('#tokenInput', token)
       await page.selectOption('#platformSelect', 'gitlab')
       ```
   - Use the real adapter and VirtualFS implementations exposed by the app when available. Do NOT inject fake adapters or fake VFS unless a `--use-fake` option is explicitly requested.
   - If OPFS storage is not present in the bundle or fails at runtime, implement an automatic fallback to the `{{storageFallback}}` (default `IndexedDb`) by clicking the appropriate UI control or invoking the app's public fallback mechanism.
   - Handle browser dialogs (`prompt`/`confirm`) via `page.on('dialog', ...)` and reply according to `{{actionMap}}` for prompts that require input.
   - Include waits appropriate for network/storage operations (`waitForSelector`, `waitForTimeout`, or waiting for specific output lines). Keep waits minimal but sufficient for CI stability.
   - Insert `await page.pause()` at `{{pausePoint}}` if provided.

Additional rules for generation:

- Before generating the test, analyze the provided `appendOutput` lines and interpret the intent of the scenario (e.g. "fetch remote snapshot and push an edited file"). From that interpretation produce:
   - A concise filename in camelCase that reflects the scenario (for example: `gitlabFetchEditPush.spec.ts`).
   - A one-line Japanese description placed as a top-of-file comment describing the test intent.

- Place the generated spec under `examples/test/e2e` and ensure the test file name uses the generated filename from the previous step.

- When reading connection information use the following template in the generated test (include it verbatim as the recommended snippet):

```ts
   // load GitLab config
   const candidates = [
      path.resolve(process.cwd(), 'test', 'conf', 'gitlab.config.json'),
      path.resolve(process.cwd(), '..', 'test', 'conf', 'gitlab.config.json')
   ]
   let cfg: { projectId: string; token: string; host?: string } | undefined
   for (const p of candidates) {
      try {
         const txt = await fs.readFile(p, 'utf8')
         cfg = JSON.parse(txt)
         break
      } catch (e) {
         // ignore
      }
   }
   if (!cfg) throw new Error('test/conf/gitlab.config.json が見つかりません')

   const repoUrl = `${cfg.host || ''}/${cfg.projectId}`.replace(/([^:])\/\//g, '$1/')
   const token = cfg.token
```

   Use `repoUrl` and `token` by filling the page inputs (not via URL params):

```ts
await page.fill('#repoInput', repoUrl)
await page.fill('#tokenInput', token)
```

4. Assertions:
   - Use `expect(page.locator('#output')).toContainText(...)` to assert that each expected line from `{{actionMap}}` appears in the correct sequence (or at least appears after the triggering action).
   - For network-dependent assertions (e.g., remote file counts), prefer asserting success markers such as `pull 完了` and `push 成功` rather than exact file lists unless the repository contents are stable and known.

5. Robustness:
   - If the real service is unreachable, the test should fail with a clear error message stating which external dependency is missing.
   - Keep selectors and action names configurable at the top of the test file for easy adjustment.
   - Add brief inline comments explaining fallbacks and assumptions.

6. Output deliverables:
   - A ready-to-run Playwright spec file path `{{outputSpecPath}}` that implements the above.
   - A short README snippet with the minimal commands to run the test and how to enable headed debugging (`PWDEBUG=1` and `--headed`).

7. When producing the test file, include a top-of-file comment that lists the required local services and `test`/`examples` npm scripts to run beforehand.

Example invocation (replace placeholders):
- `uiFileOrSelectedCode`: `examples/src/app.ts`
- `actionMap`: [
    { action: "click #connectBtn", expect: "接続を試みます..." },
    { action: "click #connectOpfs", expect: "VirtualFS.init() 実行済み" },
    { action: "click #fetchRemote", expect: "pull 完了" },
    { action: "dialog prompt -> tt1.txt", expect: "ローカル編集しました: tt1.txt" },
    { action: "click #pushLocal", expect: "push 成功" }
  ]
- `configPath`: `test/conf/gitlab.config.json`
- `storageFallback`: `IndexedDb`
- `pausePoint`: `beforeEdit`

Return: the Playwright spec file contents and the README snippet. Ensure the produced spec follows the repository's ESM/TypeScript and testing conventions.
