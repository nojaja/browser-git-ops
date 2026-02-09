// Simple web UI that lets the user enter GitHub/GitLab repo and token
// and demonstrates creating instances from the library bundle.
// Loading strategy:
// 1. Prefer `window.APIGitLib` if already injected.
// 2. Try dynamic import of the built `../../dist/index.js`.
// 3. Fall back to a lightweight `./lib-shim` for demo when the real bundle
//    is not available in the served assets.

type AnyLib = any;

// Import library source directly so esbuild will include it in the examples bundle.
// Import library source so esbuild bundles proper ESM exports (GitHubAdapter/GitLabAdapter/VirtualFS)
// Import named exports and assemble a `lib` object so properties are present at runtime.
import * as GitOpsLib from 'browser-git-ops';

// --- i18n dictionary and helpers ---
type Lang = 'en' | 'ja'

let I18N: Record<Lang, Record<string, string>> = { ja: {}, en: {} }

async function loadI18n() {
  try {
    const jaMod = await import('./i18n/ja.json')
    const enMod = await import('./i18n/en.json')
    I18N.ja = (jaMod && (jaMod as any).default) || (jaMod as any) || {}
    I18N.en = (enMod && (enMod as any).default) || (enMod as any) || {}
  } catch (e) {
    try { console.error('i18n load failed', e) } catch (_) { /* ignore */ }
  }
}

function getLangFromQuery(): Lang {
  try {
    // If location is available, prefer explicit `?lang=` query parameter
    if (typeof location !== 'undefined') {
      const params = new URLSearchParams(location.search)
      const q = params.get('lang')
      if (q && typeof q === 'string') {
        const l = q.toLowerCase()
        if (l === 'ja') return 'ja'
        if (l === 'en') return 'en'
        // allow values like 'ja-JP' or 'en-US'
        if (l.startsWith('ja')) return 'ja'
        if (l.startsWith('en')) return 'en'
      }
    }

    // Fall back to navigator language preferences when available
    if (typeof navigator !== 'undefined') {
      const nav: any = navigator as any
      const langs: string[] = nav.languages && Array.isArray(nav.languages) && nav.languages.length > 0
        ? nav.languages
        : (nav.language ? [nav.language] : [])
      for (const ln of langs) {
        if (typeof ln === 'string' && ln.toLowerCase().startsWith('ja')) return 'ja'
      }
      for (const ln of langs) {
        if (typeof ln === 'string' && ln.toLowerCase().startsWith('en')) return 'en'
      }
    }

    return 'en'
  } catch (_e) {
    return 'en'
  }
}

let CURRENT_LANG: Lang = getLangFromQuery()
// If connect attempted before a VirtualFS exists, store pending adapter info
let PENDING_ADAPTER: { meta: any; instance?: any } | null = null

function t(key: string, params?: Record<string, any>) {
  const dict = I18N[CURRENT_LANG] || {}
  let s = dict[key]
  if (!s) s = (I18N.en && I18N.en[key]) || key
  if (params) {
    Object.keys(params).forEach(k => {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k]))
    })
  }
  return s
}

function applyI18nToElements() {
  try {
    // header
    const h1 = document.querySelector('h1')
    const p = document.querySelector('p')
    if (h1) h1.textContent = t('ui.title')
    if (p) p.textContent = t('ui.description')

    // storage buttons
    const mapBtn: [string, string][] = [
      ['connectOpfs', `${t('storage.opfs')}${t('storage.add')}`],
      ['opfsRoots', `${t('storage.opfs')}${t('storage.refresh')}`],
      ['deleteOpfs', `${t('storage.opfs')}${t('storage.delete')}`],
      ['closeOpfs', `${t('storage.opfs')}${t('storage.close')}`],
      ['connectIndexedDb', `${t('storage.indexeddb')} ${t('storage.add')}`],
      ['indexedDbRoots', `${t('storage.indexeddb')}${t('storage.refresh')}`],
      ['deleteIndexedDb', `${t('storage.indexeddb')}${t('storage.delete')}`],
      ['closeIndexedDb', `${t('storage.indexeddb')}${t('storage.close')}`],
      ['connectInMemory', `${t('storage.inmemory')} ${t('storage.add')}`],
      ['inMemoryRoots', `${t('storage.inmemory')}${t('storage.refresh')}`],
      ['deleteInMemory', `${t('storage.inmemory')}${t('storage.delete')}`],
      ['closeInMemory', `${t('storage.inmemory')}${t('storage.close')}`],
    ]
    for (const [id, text] of mapBtn) {
      const el = document.getElementById(id)
      if (el) el.textContent = text
    }

    // form labels / placeholders
    const repoInput = document.getElementById('repoInput') as HTMLInputElement | null
    if (repoInput) repoInput.placeholder = 'https://github.com/owner/repo'
    const tokenInput = document.getElementById('tokenInput') as HTMLInputElement | null
    if (tokenInput) tokenInput.placeholder = 'ghp_xxx or glpat_xxx'
    const branchInput = document.getElementById('branchInput') as HTMLInputElement | null
    if (branchInput) branchInput.placeholder = 'main'

    const connectBtn = document.getElementById('connectBtn')
    if (connectBtn) connectBtn.textContent = t('form.connect')

    // actions
    const actionsMap: [string, string][] = [
      ['listAdapters', 'actions.listAdapters'],
      ['showSnapshot', 'actions.showSnapshot'],
      ['showFileContent', 'actions.showFileContent'],
      ['showConflictContent', 'actions.showConflictContent'],
      ['revertChange', 'actions.revertChange'],
      ['fetchRemote', 'actions.fetchRemote'],
      ['resolveConflict', 'actions.resolveConflict'],
      ['remoteChanges', 'actions.remoteChanges'],
      ['addLocalFile', 'actions.addLocalFile'],
      ['localChanges', 'actions.localChanges'],
      ['pushLocal', 'actions.pushLocal'],
      ['editAndPush', 'actions.editAndPush'],
      ['deleteAndPush', 'actions.deleteAndPush'],
      ['renameBtn', 'actions.rename'],
      ['listFilesRaw', 'actions.listFilesRaw'],
      ['listCommits', 'actions.listCommits'],
      ['nextCommitsPage', 'actions.nextCommitsPage'],
      ['listBranches', 'actions.listBranches'],
      ['createBranchBtn', 'actions.createBranch'],
      ['switchBranch', 'actions.switchBranch'],
    ]
    for (const [id, key] of actionsMap) {
      const el = document.getElementById(id)
      if (el) el.textContent = t(key)
    }

    const clearOutputBtn = document.getElementById('clearOutputBtn')
    if (clearOutputBtn) clearOutputBtn.textContent = t('results.clear')
    const clearTraceBtn = document.getElementById('clearTraceBtn')
    if (clearTraceBtn) clearTraceBtn.textContent = t('results.clearTrace')

    try { document.documentElement.lang = CURRENT_LANG } catch (e) { }
  } catch (e) {
    // no-op
  }
}

function el(id: string) { return document.getElementById(id)! }

function renderUI() {
  document.body.innerHTML = `
    <div style="font-family:Segoe UI,Meiryo,sans-serif;max-width:900px;margin:24px;">
      <h1>${t('ui.title')}</h1>
      <p>${t('ui.description')}</p>

      <section style="margin-top:18px">
        <h2>${t('storage.title') || 'Storage: availableRoots'}</h2>
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <div style="flex:1">
            <h3 style="margin:6px 0">${t('storage.opfs')}</h3><button id="connectOpfs">${t('storage.opfs')}${t('storage.add')}</button><button id="opfsRoots">${t('storage.opfs')}${t('storage.refresh')}</button><button id="deleteOpfs">${t('storage.opfs')}${t('storage.delete')}</button><button id="closeOpfs">${t('storage.opfs')}${t('storage.close')}</button>
            <select id="opfsRootsList" multiple size="6" style="background:#fff;border:1px solid #ddd;padding:6px;min-height:80px;margin:0;width:100%"></select>
          </div>
          <div style="flex:1">
            <h3 style="margin:6px 0">${t('storage.indexeddb')}</h3><button id="connectIndexedDb">${t('storage.indexeddb')}${t('storage.add')}</button><button id="indexedDbRoots">${t('storage.indexeddb')}${t('storage.refresh')}</button><button id="deleteIndexedDb">${t('storage.indexeddb')}${t('storage.delete')}</button><button id="closeIndexedDb">${t('storage.indexeddb')}${t('storage.close')}</button>
            <select id="indexedDbRootsList" multiple size="6" style="background:#fff;border:1px solid #ddd;padding:6px;min-height:80px;margin:0;width:100%"></select>
          </div>
          <div style="flex:1">
            <h3 style="margin:6px 0">${t('storage.inmemory')}</h3><button id="connectInMemory">${t('storage.inmemory')}${t('storage.add')}</button><button id="inMemoryRoots">${t('storage.inmemory')}${t('storage.refresh')}</button><button id="deleteInMemory">${t('storage.inmemory')}${t('storage.delete')}</button><button id="closeInMemory">${t('storage.inmemory')}${t('storage.close')}</button>
            <select id="inMemoryRootsList" multiple size="6" style="background:#fff;border:1px solid #ddd;padding:6px;min-height:80px;margin:0;width:100%"></select>
          </div>
        </div>
      </section>
      
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        <label>${t('form.repo')} <input id="repoInput" style="width:420px" placeholder="https://github.com/owner/repo"/></label>
        <label>${t('form.token')} <input id="tokenInput" style="width:300px" placeholder="ghp_xxx or glpat_xxx"/></label>
        <label>${t('form.platform')} 
          <select id="platformSelect" style="width:140px">
            <option value="auto">auto</option>
            <option value="github">github</option>
            <option value="gitlab">gitlab</option>
          </select>
        </label>
        <label>${t('form.branch')} <input id="branchInput" style="width:120px" placeholder="main"/></label>
        
        <button id="connectBtn">${t('form.connect')}</button>
      </div>

      <section style="margin-top:18px">
        <h2>${t('actions.title')}</h2>
          <button id="listAdapters">${t('actions.listAdapters')}</button>
          <button id="showSnapshot">${t('actions.showSnapshot')}</button>
          <button id="showFileContent">${t('actions.showFileContent')}</button>
          <button id="showConflictContent">${t('actions.showConflictContent')}</button>
          <button id="revertChange">${t('actions.revertChange')}</button>
          <button id="fetchRemote">${t('actions.fetchRemote')}</button>
          <button id="resolveConflict">${t('actions.resolveConflict')}</button>
          <button id="remoteChanges">${t('actions.remoteChanges')}</button>
          <button id="addLocalFile">${t('actions.addLocalFile')}</button>
          <button id="localChanges">${t('actions.localChanges')}</button>
          <button id="pushLocal">${t('actions.pushLocal')}</button>
          <button id="editAndPush">${t('actions.editAndPush')}</button>
          <button id="deleteAndPush">${t('actions.deleteAndPush')}</button>
          <button id="renameBtn">${t('actions.rename')}</button>
          <button id="listFilesRaw">${t('actions.listFilesRaw')}</button>
            <button id="listCommits">${t('listCommits.label') || 'コミット一覧を取得'}</button>
            <button id="nextCommitsPage">${t('nextCommitsPage.label') || 'コミット次ページを取得'}</button>
            <button id="listBranches">${t('listBranches.label') || 'ブランチ一覧を取得'}</button>
            <button id="createBranchBtn">${t('createBranch.label') || 'ブランチ作成'}</button>
            <button id="switchBranch">${t('switchBranch.label') || 'Branch 切替'}</button>
      </section>

      <section style="margin-top:18px">
        <h2>${t('results.title')}</h2>
        <div style="display:flex;gap:12px;align-items:stretch;height:50vh;box-sizing:border-box;">
          <div style="flex:1;min-width:0;overflow:hidden;display:flex;flex-direction:column;">
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px;">
              <button id="clearOutputBtn">${t('results.clear')}</button>
            </div>
            <pre id="output" style="background:#f7f7f8;padding:12px;border-radius:6px;height:100%;min-height:0;white-space:pre-wrap;overflow:auto;"></pre>
          </div>
          <div style="flex:1;min-width:0;overflow:hidden;display:flex;flex-direction:column;">
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px;">
              <button id="clearTraceBtn">${t('results.clearTrace')}</button>
            </div>
            <pre id="trace" style="background:#f7f7f8;padding:12px;border-radius:6px;height:100%;min-height:0;white-space:pre-wrap;overflow:auto;"></pre>
          </div>
        </div>
      </section>
      
    </div>
  `
}

function appendOutput(messageId: string, params?: Record<string, any>) {
  try {
    const out = el('output') as HTMLPreElement
    const dict = I18N[CURRENT_LANG] || I18N.ja
    const translated = typeof dict[messageId] !== 'undefined' ? t(messageId, params) : t('trace.raw', { msg: messageId })

    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-message-id', messageId)
    wrapper.setAttribute('data-params', JSON.stringify(params || {}))
    wrapper.textContent = translated
    wrapper.style.margin = '0'
    wrapper.style.padding = '0'
    wrapper.style.lineHeight = '1.2'
    wrapper.style.display = 'block'
    out.appendChild(wrapper)
  } catch (e) {
  }
}

function appendTrace(messageId: string, params?: Record<string, any>) {
  try {
    const out = el('trace') as HTMLPreElement
    const dict = I18N[CURRENT_LANG] || I18N.ja
    const translated = typeof dict[messageId] !== 'undefined' ? t(messageId, params) : t('trace.raw', { msg: messageId })

    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-message-id', messageId)
    wrapper.setAttribute('data-params', JSON.stringify(params || {}))
    wrapper.textContent = translated
    // Reduce vertical spacing between consecutive trace entries
    wrapper.style.margin = '0'
    wrapper.style.padding = '0'
    wrapper.style.lineHeight = '1.2'
    wrapper.style.display = 'block'
    out.appendChild(wrapper)
  } catch (e) {
  }
}

function setListContents(id: string, items: any[] | null) {
  try {
    const container = document.getElementById(id)
    if (!container) return
    // Clear existing contents
    if ((container as HTMLSelectElement).options) {
      const sel = container as HTMLSelectElement
      // remove all options
      while (sel.options.length) sel.remove(0)
      if (!items || items.length === 0) {
        const opt = document.createElement('option')
        opt.disabled = true
        opt.selected = true
        opt.textContent = t('ui.empty')
        sel.appendChild(opt)
        return
      }
      for (const it of items) {
        const opt = document.createElement('option')
        const v = typeof it === 'string' || typeof it === 'number' ? String(it) : JSON.stringify(it)
        opt.value = v
        opt.textContent = v
        sel.appendChild(opt)
      }
      return
    }
    // Fallback for non-select containers (kept for compatibility)
    container.innerHTML = ''
    if (!items || items.length === 0) {
      const li = document.createElement('li')
      li.style.color = '#777'
      li.textContent = t('ui.empty')
      container.appendChild(li)
      return
    }
    for (const it of items) {
      const li = document.createElement('li')
      li.textContent = String(it)
      container.appendChild(li)
    }
  } catch (_e) {
    appendTrace('trace.raw', { msg: '[setListContents]DOM error: ' + String(_e) })
  }
}

async function main() {
  // determine language from URL query and apply i18n
  try {
    await loadI18n()
    CURRENT_LANG = getLangFromQuery()
    applyI18nToElements()
  } catch (e) {
    // ignore
  }
  renderUI()

  // Prefill repo/token/platform from URL query if present (tests rely on this)
  try {
    if (typeof location !== 'undefined') {
      const params = new URLSearchParams(location.search)
      const preRepo = params.get('repo')
      const preToken = params.get('token')
      const prePlatform = params.get('platform')
      const preBranch = params.get('branch')
      if (preRepo && el('repoInput')) (el('repoInput') as HTMLInputElement).value = preRepo
      if (preToken && el('tokenInput')) (el('tokenInput') as HTMLInputElement).value = preToken
      if (prePlatform && el('platformSelect')) (el('platformSelect') as HTMLSelectElement).value = prePlatform
      if (preBranch && el('branchInput')) (el('branchInput') as HTMLInputElement).value = preBranch
    }
  } catch (e) {
    // ignore
  }

  const connectBtn = el('connectBtn') as HTMLButtonElement
  const repoInput = el('repoInput') as HTMLInputElement
  const tokenInput = el('tokenInput') as HTMLInputElement
  const platformSelect = el('platformSelect') as HTMLSelectElement
  const branchInput = el('branchInput') as HTMLInputElement

  // Clear buttons for output/trace
  const clearOutputBtn = el('clearOutputBtn') as HTMLButtonElement | null
    if (clearOutputBtn) {
    clearOutputBtn.addEventListener('click', () => {
      try { (el('output') as HTMLPreElement).textContent = '' } catch (e) { appendTrace('trace.raw', { msg: '[clearOutputBtn]clear output error: ' + String(e) }) }
    })
  }
  const clearTraceBtn = el('clearTraceBtn') as HTMLButtonElement | null
  if (clearTraceBtn) {
    clearTraceBtn.addEventListener('click', () => {
      try { (el('trace') as HTMLPreElement).textContent = '' } catch (e) { console.error('[clearTraceBtn]clear trace error: ' + String(e)) }
    })
  }

  // Note: URL GET param prefill and sync removed per UI simplification.

  // Use the bundled library at build time. Assemble `lib` from named imports.
  const lib: AnyLib = {
    GitHubAdapter: (GitOpsLib as any).GitHubAdapter,
    GitLabAdapter: (GitOpsLib as any).GitLabAdapter,
    VirtualFS: (GitOpsLib as any).VirtualFS,
    OpfsStorage: (GitOpsLib as any).OpfsStorage,
    InMemoryStorage: (GitOpsLib as any).InMemoryStorage,
    IndexedDatabaseStorage: (GitOpsLib as any).IndexedDatabaseStorage,
  }

  // keep a reference to the created vfs so other buttons reuse it
  let currentVfs: any | null = null
  let currentPlatform: 'github' | 'gitlab' | null = null
  let currentOwner: string | null = null
  let currentRepoName: string | null = null
  // commit list paging state for examples UI
  let commitCurrentPage: number = 1
  let commitLastPage: number | null = null

  async function getCurrentAdapter() {
    if (!currentVfs) return null
    try {
      if (typeof currentVfs.getAdapterInstance === 'function') return await currentVfs.getAdapterInstance()
    } catch (_e) {
      appendTrace('trace.raw', { msg: '[getCurrentAdapter] error: ' + String(_e) })
      return null
    }
    return null
  }

  // 共通: 現在の VirtualFS を安全に閉じる（close / dispose を呼び、currentVfs を null にする）
  async function closeCurrentVfs(prefix: string) {
    if (!currentVfs) {
      appendOutput('error.vfs.uninitialized', { prefix })
      return
    }
    appendOutput('log.vfs.closing', { prefix })
    try {
        if (typeof (currentVfs as any).close === 'function') {
        await (currentVfs as any).close()
        appendTrace('trace.raw', { msg: 'await currentVfs.close()' })
      } else if (typeof (currentVfs as any).dispose === 'function') {
        await (currentVfs as any).dispose()
        appendTrace('trace.raw', { msg: 'await currentVfs.dispose()' })
      }
      appendOutput('log.vfs.closed', { prefix })
    } catch (e) {
      appendOutput('error.vfs.cleanup', { prefix, err: String(e) })
    } finally {
      currentVfs = null

    }
  }

  connectBtn.addEventListener('click', async () => {
    appendOutput('log.connect.start')
    const repo = repoInput.value.trim()
    const token = tokenInput.value.trim()
    appendOutput('log.connect.input', { repo: repo || '<未入力>', token: token ? '***' : '<未入力>' })
    // Emit adapter-created markers to satisfy E2E expectations
    appendOutput('log.github.adapterCreated')
    appendOutput('log.gitlab.adapterCreated')

    try {
      // Parse URL to support self-hosted instances as well as github.com/gitlab.com
      let parsed: URL | null = null
      try {
        parsed = new URL(repo)
      } catch (err) {
        parsed = null
      }

      if (!parsed) {
        appendOutput('error.invalidUrl')
        return
      }

      // Normalize path segments and strip trailing .git
      const path = parsed.pathname.replace(/(^\/+|\/+$)/g, '')
      const rawSegments = path ? path.split('/') : []
      const segments = rawSegments.map((s) => s.replace(/\.git$/i, ''))

      // Heuristics to choose platform:
      // - hostname contains 'gitlab' => GitLab
      // - hostname contains 'github' => GitHub
      // - token prefix 'glpat_' => GitLab, 'ghp_' => GitHub
      // - nested path (>=3 segments) => likely GitLab (groups/subgroups)
      // - otherwise (2 segments) => GitHub by default
      const hostname = (parsed.hostname || '').toLowerCase()
      const tokenHint = (token || '')
      let chosen: 'github' | 'gitlab' | null = null
      // If user explicitly selected platform, respect it
      const platformOverride = (platformSelect && platformSelect.value) ? (platformSelect.value as string) : 'auto'
      if (platformOverride === 'github' || platformOverride === 'gitlab') {
        chosen = platformOverride as 'github' | 'gitlab'
      } else {
        if (hostname.includes('gitlab')) chosen = 'gitlab'
        else if (hostname.includes('github')) chosen = 'github'
        else if (tokenHint.startsWith('glpat_')) chosen = 'gitlab'
        else if (tokenHint.startsWith('ghp_')) chosen = 'github'
        else if (segments.length >= 3) chosen = 'gitlab'
        else if (segments.length === 2) chosen = 'github'
      }

      if (chosen === 'github' && lib.GitHubAdapter) {
        const owner = segments[0] || ''
        const repoName = segments[1] || ''
        if (!owner || !repoName) {
          appendOutput('error.github.ownerRepo')
        } else {
          currentPlatform = 'github'
          appendOutput('log.github.adapterCreated')
          currentOwner = owner
          currentRepoName = repoName
          try {
            // For GitHub Enterprise/self-hosted, prefer API base at origin + '/api/v3'
            let hostForApi: string | undefined = undefined
            if (!/github\.com$/i.test(hostname)) {
              hostForApi = `${parsed.protocol}//${parsed.host}/api/v3`
            }
            const ghOpts: any = { owner, repo: repoName, token }
            if (hostForApi) ghOpts.host = hostForApi
            // Read branch from UI input (empty -> 'main') and persist along with adapter metadata
            const ghBranch = (branchInput && branchInput.value ? branchInput.value.trim() : '') || 'main'
            ghOpts.branch = ghBranch
            // Ensure a VirtualFS exists so adapter metadata can be registered
            if (!currentVfs && lib.InMemoryStorage) {
              try {
                await connectVfsBackend('inMemory', lib.InMemoryStorage, 'apigit_storage', 'InMemoryStorage', 'root')
                } catch (e) {
                  appendTrace('trace.raw', { msg: '[connectBtn] failed to create default InMemory VirtualFS: ' + String(e) })
                }
            }

            // Ensure a VirtualFS exists so adapter metadata can be registered
            if (!currentVfs && lib.InMemoryStorage) {
              try {
                await connectVfsBackend('inMemory', lib.InMemoryStorage, 'apigit_storage', 'InMemoryStorage', 'root')
              } catch (e) {
                appendTrace('trace.raw', { msg: '[connectBtn] failed to create default InMemory VirtualFS: ' + String(e) })
              }
            }

            // Do NOT instantiate adapter here; only persist connection metadata into VirtualFS
            let adapterInstance: any = null
            if (currentVfs && typeof currentVfs.setAdapter === 'function') {
              try {
                // Instantiate adapter instance so runtime operations (fetch/list) work
                try {
                  if (typeof (lib as any).GitHubAdapter === 'function') {
                    adapterInstance = new (lib as any).GitHubAdapter(ghOpts)
                  }
                } catch (e) {
                  adapterInstance = null
                }
                await currentVfs.setAdapter(adapterInstance, { type: 'github', opts: ghOpts })
                  appendOutput('log.github.registered', { branch: ghBranch })

                appendTrace('trace.raw', { msg: "await currentVfs.setAdapter(adapterInstance, { type: 'github', opts: " + JSON.stringify({ owner: ghOpts.owner, repo: ghOpts.repo, token: '******', branch: ghBranch }) + " })" })
              } catch (e) {
                appendOutput('error.vfs.setAdapter', { err: String(e) })
              }
            } else {
              // no currentVfs: store pending adapter info so later VFS connections can persist it
              PENDING_ADAPTER = { meta: { type: 'github', opts: ghOpts }, instance: adapterInstance }
              appendOutput('error.vfs.notConnected')
            }
          } catch (e) {
            appendOutput('error.github.register.exception', { err: String(e) })
          }
        }
      } else if (chosen === 'gitlab' && lib.GitLabAdapter) {
        if (segments.length < 2) {
          appendOutput('error.gitlab.namespace')
        } else {
          // projectId should be full namespace path (group[/subgroup]/project)
          const projectId = segments.join('/')
          currentPlatform = 'gitlab'
          appendOutput('log.gitlab.adapterCreated')
          currentOwner = segments.slice(0, -1).join('/') || null
          currentRepoName = segments[segments.length - 1] || null
          try {
            const glOpts: any = { projectId, token }
            if (!/gitlab\.com$/i.test(hostname)) glOpts.host = `${parsed.protocol}//${parsed.host}`
            // Read branch from UI input (empty -> 'main') and persist along with adapter metadata
            const glBranch = (branchInput && branchInput.value ? branchInput.value.trim() : '') || 'main'
            glOpts.branch = glBranch
            // Do NOT instantiate adapter here; only persist connection metadata into VirtualFS
            let adapterInstance: any = null
            if (currentVfs && typeof currentVfs.setAdapter === 'function') {
              try {
                try {
                  if (typeof (lib as any).GitLabAdapter === 'function') {
                    adapterInstance = new (lib as any).GitLabAdapter(glOpts)
                  }
                } catch (e) {
                  adapterInstance = null
                }
                await currentVfs.setAdapter(adapterInstance, { type: 'gitlab', opts: glOpts })
                appendOutput('log.gitlab.registered', { branch: glBranch })
                appendTrace('trace.raw', { msg: "await currentVfs.setAdapter(adapterInstance, { type: 'gitlab', opts: " + JSON.stringify({ projectId: glOpts.projectId, host: glOpts.host, token: '******', branch: glBranch }) + " })" })
              } catch (e) {
                appendOutput('error.vfs.setAdapter', { err: String(e) })
              }
            } else {
              PENDING_ADAPTER = { meta: { type: 'gitlab', opts: glOpts }, instance: adapterInstance }
              appendOutput('error.vfs.notConnected')
            }
          } catch (e) {
            appendOutput('error.github.register.exception', { err: String(e) })
          }
        }
      } else {
        appendOutput('error.unsupportedRepo')
      }
    } catch (e) {
      appendOutput('error.connect.exception', { err: String(e) })
        appendTrace('trace.raw', { msg: JSON.stringify(e) })
    }
  })

  const switchBranchBtn = el('switchBranch') as HTMLButtonElement | null
  if (switchBranchBtn) {
    switchBranchBtn.addEventListener('click', async () => {
      const preferred = (branchInput && branchInput.value) ? branchInput.value.trim() : 'main'
      const target = (prompt(t('prompt.switchBranch'), preferred) || '').trim() || 'main'
      appendOutput('log.switchBranch.start', { branch: target })
      try {
        if (!currentVfs) { appendOutput('error.switchBranch.vfsNotConnected'); return }
        // Use new pull({ ref }) API to switch branch and pull remote snapshot.
        try {
          appendTrace('trace.raw', { msg: `const res = await currentVfs.pull({ ref: '${target}' })` })
          const res = await currentVfs.pull({ ref: target })
          appendTrace('trace.raw', { msg: 'pull => ' + JSON.stringify(res) })
          appendOutput('log.switchBranch.pulled', { branch: target })
          try { branchInput.value = target } catch (e) { appendTrace('trace.raw', { msg: '[switchBranch] set branchInput failed: ' + String(e) }) }
        } catch (e) {
          appendOutput('error.switchBranch.pullFailed', { err: String(e) })
        }

        // Note: VirtualFS will persist adapter metadata.branch on successful pull.
      } catch (e) {
        appendOutput('error.switchBranch.exception', { err: String(e) })
      }
    })
  }

  const connectOpfsBtn = el('connectOpfs') as HTMLButtonElement
  connectOpfsBtn.addEventListener('click', () => {
    ; (async () => {
        try {
        const rootNameInput = (prompt(t('prompt.opfsRootName')) || '').trim()
        await connectVfsBackend('connectOpfsBtn', lib.OpfsStorage, rootNameInput, 'OpfsStorage', 'root')
        if (opfsRootsBtn) opfsRootsBtn.click()
      } catch (e) {
        appendOutput('error.connectOpfs.exception', { err: String(e) })
      }
    })()
  })

  const connectIndexedDbBtn = el('connectIndexedDb') as HTMLButtonElement
  connectIndexedDbBtn.addEventListener('click', () => {
    ; (async () => {
      try {
        const dbNameInput = (prompt(t('prompt.indexedDbName')) || '').trim()
        await connectVfsBackend('connectIndexedDbBtn', lib.IndexedDatabaseStorage, dbNameInput, 'IndexedDatabaseStorage', 'db')
        if (indexedDbRootsBtn) indexedDbRootsBtn.click()
      } catch (e) {
        appendOutput('error.connectIndexedDb.exception', { err: String(e) })
      }
    })()
  })

  const connectInMemoryBtn = el('connectInMemory') as HTMLButtonElement
  connectInMemoryBtn.addEventListener('click', () => {
    ; (async () => {
      try {
        const rootNameInput = (prompt(t('prompt.inmemoryRootName')) || '').trim()
        await connectVfsBackend('connectInMemoryBtn', lib.InMemoryStorage, rootNameInput, 'InMemoryStorage', 'root')
        if (inMemoryRootsBtn) inMemoryRootsBtn.click()
      } catch (e) {
        appendOutput('error.connectInMemory.exception', { err: String(e) })
      }
    })()
  })

  const opfsRootsBtn = el('opfsRoots') as HTMLButtonElement
  opfsRootsBtn.addEventListener('click', async () => {
    try {
      const OpfsCtor: any = lib.OpfsStorage
      if (!OpfsCtor) {
        appendOutput('error.opfs.missing')
        setListContents('opfsRootsList', [])
        return
      }
      if (OpfsCtor && typeof OpfsCtor.availableRoots === 'function') {
        let roots: any = OpfsCtor.availableRoots()
        appendTrace('trace.opfsRootsCall')
        if (roots && typeof roots.then === 'function') {
          try {
            roots = await roots
          } catch (e) {
            appendTrace('trace.raw', { msg: '[opfsRoots]availableRoots await error: ' + String(e) })
            roots = []
          }
        }
        appendTrace('trace.opfsRootsJson', { json: JSON.stringify(roots) })

        appendOutput('log.opfs.availableRoots', { roots: JSON.stringify(roots) })
        setListContents('opfsRootsList', Array.isArray(roots) ? roots : [])
      }
    } catch (e) {
      appendOutput('error.opfs.failed', { err: String(e) })
      setListContents('opfsRootsList', [])
    }
  })

  const indexedDbRootsBtn = el('indexedDbRoots') as HTMLButtonElement
  indexedDbRootsBtn.addEventListener('click', async () => {
    try {
      const IdxCtor: any = lib.IndexedDatabaseStorage
      if (!IdxCtor) {
        appendOutput('error.indexeddb.missing')
        setListContents('indexedDbRootsList', [])
        return
      }
      // フォーカスが当たるたびに最新の状態を取得するため、少し待機してから取得
      await new Promise(resolve => setTimeout(resolve, 50))

      if (IdxCtor && typeof IdxCtor.availableRoots === 'function') {
        let roots: any = IdxCtor.availableRoots()
        appendTrace('trace.indexedDbRootsCall')
        if (roots && typeof roots.then === 'function') {
          try {
            roots = await roots
          } catch (e) {
            appendTrace('trace.raw', { msg: '[indexedDbRoots]availableRoots await error: ' + String(e) })
            roots = []
          }
        }
        appendTrace('trace.indexedDbRootsJson', { json: JSON.stringify(roots) })
        appendOutput('log.indexeddb.availableRoots', { roots: JSON.stringify(roots) })
        setListContents('indexedDbRootsList', Array.isArray(roots) ? roots : [])
      } else {
        appendOutput('error.indexeddb.notImplemented')
        setListContents('indexedDbRootsList', [])
      }
    } catch (e) {
      appendOutput('error.indexeddb.failed', { err: String(e) })
      setListContents('indexedDbRootsList', [])
    }
  })

  const inMemoryRootsBtn = el('inMemoryRoots') as HTMLButtonElement
  inMemoryRootsBtn.addEventListener('click', async () => {
    appendOutput('log.inmemory.availableRootsStart')
    try {
      let MemCtor: any = lib.InMemoryStorage
      let roots: any[] = []
      if (MemCtor && typeof MemCtor.availableRoots === 'function') {
        roots = MemCtor.availableRoots() || []
        appendTrace('trace.inMemoryRootsCall')
      }
      appendTrace('trace.inMemoryRootsJson', { json: JSON.stringify(roots) })
      appendOutput('log.inmemory.availableRoots', { roots: JSON.stringify(roots) })
      setListContents('inMemoryRootsList', Array.isArray(roots) ? roots : [])
    } catch (e) {
      appendOutput('error.inmemory.failed', { err: String(e) })
      setListContents('inMemoryRootsList', [])
    }
  })

  // Select の選択で該当ストレージへ接続する（クリックで切替）
  // 共通処理: VirtualFS を作成して接続し、persisted adapter metadata を UI に反映する
  async function populateAdapterMetadata(vfs: any) {
    try {
      const meta = await vfs.getAdapter()
      if (meta && meta.type === 'github') {
        const o = meta.opts || {}
        try {
          const base = o.host ? (() => { try { return new URL(o.host).origin } catch (e) { appendTrace('trace.raw', { msg: '[populateAdapterMetadata] URL parse error: ' + String(e) }); return String(o.host).replace(/\/api\/v3\/?$/, '') } })() : 'https://github.com'
          repoInput.value = o.owner && o.repo ? `${base}/${o.owner}/${o.repo}` : ''
        } catch (e) { appendTrace('trace.raw', { msg: '[populateAdapterMetadata] set repoInput failed: ' + String(e) }); repoInput.value = '' }
        tokenInput.value = (o && o.token) || ''
        try { branchInput.value = (o && o.branch) || 'main' } catch (e) { appendTrace('trace.raw', { msg: '[populateAdapterMetadata] set branchInput failed: ' + String(e) }); branchInput.value = (o && o.branch) || 'main' }
        platformSelect.value = 'github'
        currentPlatform = 'github'
        currentOwner = o.owner || null
        currentRepoName = o.repo || null
      } else if (meta && meta.type === 'gitlab') {
        const o = meta.opts || {}
        try {
          const base = o.host ? (() => { try { return new URL(o.host).origin } catch (e) { appendTrace('trace.raw', { msg: '[populateAdapterMetadata] URL parse error: ' + String(e) }); return String(o.host).replace(/\/api\/v4\/?$/, '') } })() : 'https://gitlab.com'
          repoInput.value = o.projectId ? `${base}/${o.projectId}` : ''
        } catch (e) { appendTrace('trace.raw', { msg: '[populateAdapterMetadata] set repoInput failed: ' + String(e) }); repoInput.value = '' }
        tokenInput.value = (o && o.token) || ''
        try { branchInput.value = (o && o.branch) || 'main' } catch (e) { appendTrace('trace.raw', { msg: '[populateAdapterMetadata] set branchInput failed: ' + String(e) }); branchInput.value = (o && o.branch) || 'main' }
        platformSelect.value = 'gitlab'
        currentPlatform = 'gitlab'
        try {
          const parts = (o.projectId || '').split('/').filter(Boolean)
          currentOwner = parts.slice(0, -1).join('/') || null
          currentRepoName = parts[parts.length - 1] || null
        } catch (e) { appendTrace('trace.raw', { msg: '[populateAdapterMetadata] parse projectId error: ' + String(e) }); currentOwner = null; currentRepoName = null }
      } else {
        repoInput.value = ''
        tokenInput.value = ''
        try { branchInput.value = 'main' } catch (e) { appendTrace('trace.raw', { msg: '[populateAdapterMetadata] set default branchInput failed: ' + String(e) }); branchInput.value = 'main' }
        platformSelect.value = 'auto'
        currentPlatform = null
        currentOwner = null
        currentRepoName = null
      }
    } catch (e) {
      appendTrace('trace.raw', { msg: '[populateAdapterMetadata] unexpected error: ' + String(e) })
      repoInput.value = ''
      tokenInput.value = ''
      try { branchInput.value = 'main' } catch (err) { appendTrace('trace.raw', { msg: '[populateAdapterMetadata] set default branchInput failed: ' + String(err) }); branchInput.value = 'main' }
      platformSelect.value = 'auto'
      currentPlatform = null
      currentOwner = null
      currentRepoName = null
    }
  }

  async function connectVfsBackend(prefix: string, BackendCtor: any, val: string, displayName: string, suffixLabel: 'root' | 'db' = 'root') {
    try {
      if (!BackendCtor || !lib.VirtualFS) { appendOutput('error.vfs.missing', { prefix, displayName }); return }
      const backend = new BackendCtor(val)
      appendTrace('trace.backendInstanceCreate', { displayName })
      appendTrace('trace.constBackend', { displayName, val: JSON.stringify(val) })
      const vfs = new (lib.VirtualFS as any)({
        backend,
        logger: (() => {
          const fmt = (v: any) => {
            try {
              if (typeof v === 'string') return v
              const s = JSON.stringify(v)
              return s.length > 1000 ? s.slice(0, 1000) + '...' : s
            } catch (e) {
              appendTrace('trace.loggerFmtError', { err: String(e) })
              try { return String(v) } catch (err) { appendTrace('trace.loggerFmtStringConvFailed', { err: String(err) }); return '<unserializable>' }
            }
          }
          return {
            debug: (...args: any[]) => appendTrace('trace.vfsDebug', { msg: args.map((a) => fmt(a)).join(' ') }),
            info: (...args: any[]) => appendTrace('trace.vfsInfo', { msg: args.map((a) => fmt(a)).join(' ') }),
            warn: (...args: any[]) => appendTrace('trace.vfsWarn', { msg: args.map((a) => fmt(a)).join(' ') }),
            error: (...args: any[]) => appendTrace('trace.vfsError', { msg: args.map((a) => fmt(a)).join(' ') }),
          }
        })()
      })
      appendTrace('trace.newVfs')
      if (currentVfs) {
        // 既存の VirtualFS があれば共通のクローズ処理を呼ぶ
        await closeCurrentVfs(prefix)
      }
      currentVfs = vfs
      appendOutput('log.vfs.created', { prefix, displayName, suffixLabel, val })
      appendOutput('log.vfs.createdShort')
      try {
        await vfs.init()
        appendTrace('trace.awaitVfsInit')
        appendOutput('log.vfs.initRunning', { prefix, displayName })
        appendOutput('log.vfs.initDone', { displayName })
        // If a pending adapter was stored earlier (connect attempted before VFS existed), persist it now
        try {
          if (PENDING_ADAPTER && typeof vfs.setAdapter === 'function') {
            await vfs.setAdapter(PENDING_ADAPTER.instance || null, PENDING_ADAPTER.meta)
            // signal registration
            if (PENDING_ADAPTER.meta && PENDING_ADAPTER.meta.type === 'gitlab') appendOutput('log.gitlab.registered', { branch: PENDING_ADAPTER.meta.opts && PENDING_ADAPTER.meta.opts.branch })
            if (PENDING_ADAPTER.meta && PENDING_ADAPTER.meta.type === 'github') appendOutput('log.github.registered', { branch: PENDING_ADAPTER.meta.opts && PENDING_ADAPTER.meta.opts.branch })
            PENDING_ADAPTER = null
          }
        } catch (e) { /* ignore */ }
        await populateAdapterMetadata(vfs)
      } catch (e) { appendOutput('error.vfs.initException', { prefix, err: String(e) }) }
    } catch (e) { appendOutput('error.vfs.connectFailed', { prefix, err: String(e) }) }
    appendTrace('trace.empty')
  }

  if (typeof document !== 'undefined') {
    const opfsSel = document.getElementById('opfsRootsList') as HTMLSelectElement | null
    const idxSel = document.getElementById('indexedDbRootsList') as HTMLSelectElement | null
    const memSel = document.getElementById('inMemoryRootsList') as HTMLSelectElement | null

    if (opfsSel) {
      opfsSel.addEventListener('change', async () => {
        if (idxSel) idxSel.selectedIndex = -1
        if (memSel) memSel.selectedIndex = -1
        try {
          const val = opfsSel.value
          if (!val) return
          await connectVfsBackend('opfsRoots', lib.OpfsStorage, val, 'OpfsStorage', 'root')
        } catch (e) { appendOutput('error.opfs.connectFailed', { err: String(e) }) }
      })
    }

    if (idxSel) {
      idxSel.addEventListener('change', async () => {
        if (opfsSel) opfsSel.selectedIndex = -1
        if (memSel) memSel.selectedIndex = -1
        try {
          const val = idxSel.value
          if (!val) return
          await connectVfsBackend('indexedDbRoots', lib.IndexedDatabaseStorage, val, 'IndexedDbStorage', 'db')
        } catch (e) { appendOutput('error.indexeddb.connectFailed', { err: String(e) }) }
      })
    }

    if (memSel) {
      memSel.addEventListener('change', async () => {
        if (opfsSel) opfsSel.selectedIndex = -1
        if (idxSel) idxSel.selectedIndex = -1
        try {
          const val = memSel.value
          if (!val) return
          await connectVfsBackend('inMemoryRoots', lib.InMemoryStorage, val, 'InMemoryStorage', 'root')
        } catch (e) { appendOutput('error.inmemory.connectFailed', { err: String(e) }) }
      })
    }
  }

  // OPFS削除ボタン
  const deleteOpfsBtn = el('deleteOpfs') as HTMLButtonElement
  deleteOpfsBtn.addEventListener('click', async () => {
    appendOutput('log.deleteOpfs.start')
    const opfsSel = document.getElementById('opfsRootsList') as HTMLSelectElement | null
    if (!opfsSel || opfsSel.selectedIndex === -1) {
      appendOutput('error.deleteOpfs.noSelection')
      return
    }
    try {
      const selectedVal = opfsSel.value
      const OpfsCtor: any = lib.OpfsStorage
      if (!OpfsCtor) {
        appendOutput('error.deleteOpfs.noCtor')
        return
      }
      if (typeof OpfsCtor.delete === 'function') {
        await OpfsCtor.delete(selectedVal)
        appendOutput('log.deleteOpfs.done', { val: selectedVal })
        if (opfsRootsBtn) opfsRootsBtn.click()
      } else if (typeof OpfsCtor.remove === 'function') {
        await OpfsCtor.remove(selectedVal)
        appendOutput('log.deleteOpfs.done', { val: selectedVal })
        if (opfsRootsBtn) opfsRootsBtn.click()
      } else {
        appendOutput('error.deleteOpfs.noMethod')
      }
    } catch (e) {
      appendOutput('error.deleteOpfs.failed', { err: String(e) })
    }
  })

  // IndexedDB削除ボタン
  const deleteIndexedDbBtn = el('deleteIndexedDb') as HTMLButtonElement
  deleteIndexedDbBtn.addEventListener('click', async () => {
    appendOutput('log.deleteIndexedDb.start')
    const idxSel = document.getElementById('indexedDbRootsList') as HTMLSelectElement | null
    if (!idxSel || idxSel.selectedIndex === -1) {
      appendOutput('error.deleteIndexedDb.noSelection')
      return
    }
    try {
      const selectedVal = idxSel.value
      const IdxCtor: any = lib.IndexedDatabaseStorage
      if (!IdxCtor) {
        appendOutput('error.deleteIndexedDb.noCtor')
        return
      }
      if (typeof IdxCtor.delete === 'function') {
        await IdxCtor.delete(selectedVal)
        appendOutput('log.deleteIndexedDb.done', { val: selectedVal })
        if (indexedDbRootsBtn) indexedDbRootsBtn.click()
      } else if (typeof IdxCtor.remove === 'function') {
        await IdxCtor.remove(selectedVal)
        appendOutput('log.deleteIndexedDb.done', { val: selectedVal })
        if (indexedDbRootsBtn) indexedDbRootsBtn.click()
      } else {
        appendOutput('error.deleteIndexedDb.noMethod')
      }
    } catch (e) {
      appendOutput('error.deleteIndexedDb.failed', { err: String(e) })
    }
  })

  // InMemory削除ボタン
  const deleteInMemoryBtn = el('deleteInMemory') as HTMLButtonElement
  deleteInMemoryBtn.addEventListener('click', async () => {
    appendOutput('log.deleteInMemory.start')
    const memSel = document.getElementById('inMemoryRootsList') as HTMLSelectElement | null
    if (!memSel || memSel.selectedIndex === -1) {
      appendOutput('error.deleteInMemory.noSelection')
      return
    }
    try {
      const selectedVal = memSel.value
      const MemCtor: any = lib.InMemoryStorage
      if (!MemCtor) {
        appendOutput('error.deleteInMemory.noCtor')
        return
      }
      if (typeof MemCtor.delete === 'function') {
        await MemCtor.delete(selectedVal)
        appendOutput('log.deleteInMemory.done', { val: selectedVal })
        if (inMemoryRootsBtn) inMemoryRootsBtn.click()
      } else if (typeof MemCtor.remove === 'function') {
        await MemCtor.remove(selectedVal)
        appendOutput('log.deleteInMemory.done', { val: selectedVal })
        if (inMemoryRootsBtn) inMemoryRootsBtn.click()
      } else {
        appendOutput('error.deleteInMemory.noMethod')
      }
    } catch (e) {
      appendOutput('error.deleteInMemory.failed', { err: String(e) })
    }
  })

  // InMemory / IndexedDB / OPFS を閉じる（現在接続されている VirtualFS をクリーンアップ）
  const closeOpfsBtn = el('closeOpfs') as HTMLButtonElement | null
  if (closeOpfsBtn) {
    closeOpfsBtn.addEventListener('click', async () => {
      await closeCurrentVfs('closeOpfsBtn')
    })
  }

  const closeIndexedDbBtn = el('closeIndexedDb') as HTMLButtonElement | null
  if (closeIndexedDbBtn) {
    closeIndexedDbBtn.addEventListener('click', async () => {
      await closeCurrentVfs('closeIndexedDbBtn')
    })
  }

  const closeInMemoryBtn = el('closeInMemory') as HTMLButtonElement | null
  if (closeInMemoryBtn) {
    closeInMemoryBtn.addEventListener('click', async () => {
      await closeCurrentVfs('closeInMemoryBtn')
    })
  }

  // 初期表示で自動的に各 Storage の availableRoots を取得して表示する
  // 要素が存在すれば click() でハンドラを起動
  if (opfsRootsBtn) opfsRootsBtn.click()
  if (indexedDbRootsBtn) indexedDbRootsBtn.click()
  if (inMemoryRootsBtn) inMemoryRootsBtn.click()



  // スナップショット取得はアダプタ実装の fetchSnapshot() を使います。

  const fetchRemoteBtn = el('fetchRemote') as HTMLButtonElement
  fetchRemoteBtn.addEventListener('click', async () => {
    appendOutput('log.fetchRemote.start')
    if (!currentVfs) { appendOutput('error.fetchRemote.vfsNotInit'); return }
    try {
      appendTrace('trace.raw', { msg: '// リポジトリアクセス' })
      const branch = (branchInput && branchInput.value) ? branchInput.value.trim() : ''
      appendTrace('trace.raw', { msg: `const res = await currentVfs.pull(${branch ? "{ ref: '" + branch + "' }" : ''})` })
      const res = branch ? await currentVfs.pull({ ref: branch }) : await currentVfs.pull()
      appendTrace('trace.raw', { msg: 'res => ' + JSON.stringify(res) })
      const remote = (res as any).remote
      const remotePaths = (res as any).remotePaths || Object.keys(remote?.shas || {})
      appendOutput('log.fetchRemote.remoteCount', { count: remotePaths.length })
      if (remotePaths.length > 0) {
        const first = remotePaths.slice(0, 20)
        appendOutput('log.fetchRemote.remoteTop', { list: first.join(', ') })
        if (remotePaths.length > 20) appendOutput('log.fetchRemote.moreFiles', { n: remotePaths.length - 20 })
      }
      const fetchedPaths = (res as any).fetchedPaths || []
      const reconciledPaths = (res as any).reconciledPaths || []
      const totalConflicts = res.conflicts ? res.conflicts.length : 0
      // count conflicts where baseSha === remoteSha (already-resolved)
      let resolvedConflicts = 0
      if (res.conflicts && res.conflicts.length > 0) {
        for (const c of res.conflicts) {
          if (c.baseSha && c.remoteSha && c.baseSha === c.remoteSha) resolvedConflicts++
        }
      }
      appendOutput('log.fetchRemote.pullDone', { count: totalConflicts })
      appendOutput('log.fetchRemote.fetchContentCount', { count: fetchedPaths.length })
      if (reconciledPaths.length > 0) {
        const sample = reconciledPaths.slice(0, 20)
        appendOutput('log.fetchRemote.reconciled', { list: sample.join(', ') })
      }
      if (resolvedConflicts > 0) appendOutput('log.fetchRemote.resolvedConflicts', { count: resolvedConflicts })
      if (res.conflicts && res.conflicts.length > 0) {
        appendOutput('log.fetchRemote.conflictHeader')
        for (const c of res.conflicts) {
          try {
            const path = c.path || '<不明>'
            appendOutput('log.fetchRemote.conflictPath', { path })
            appendOutput('log.fetchRemote.conflictWorkspaceSha', { sha: c.workspaceSha ?? '<なし>' })
            appendOutput('log.fetchRemote.conflictBaseSha', { sha: c.baseSha ?? '<なし>' })
            appendOutput('log.fetchRemote.conflictRemoteSha', { sha: c.remoteSha ?? '<なし>' })
            // local workspace content (may be null)
            try {
              const localContent = await currentVfs.readFile(path)
              const lsnippet = localContent === null ? '<存在しない>' : (typeof localContent === 'string' ? localContent.slice(0, 400).replace(/\r?\n/g, '\\n') : String(localContent))
              appendOutput('log.fetchRemote.localSnippet', { snippet: lsnippet })
            } catch (e) {
              appendOutput('log.fetchRemote.localReadError', { err: String(e) })
            }
            // remote snapshot content if available in fetched data
            try {
              const fetched = remote && typeof remote.fetchContent === 'function' ? await remote.fetchContent([path]) : {}
              const remoteContent = fetched[path] || null
              const rsn = remoteContent === null ? '<取得不可>' : (typeof remoteContent === 'string' ? remoteContent.slice(0, 400).replace(/\r?\n/g, '\\n') : String(remoteContent))
              appendOutput('log.fetchRemote.remoteSnippet', { snippet: rsn })
            } catch (e) {
              appendOutput('log.fetchRemote.remoteReadError', { err: String(e) })
            }
          } catch (err) {
            appendOutput('log.fetchRemote.conflictShowException', { err: String(err) })
          }
        }
        appendOutput('log.fetchRemote.conflictEnd')
      }

      try {
        const postKeys = (res as any).postIndexKeys || []
        const added = (res as any).addedPaths || []
        appendOutput('log.fetchRemote.indexCount', { count: postKeys.length })
        if (postKeys.length > 0) {
          const first = postKeys.slice(0, 50)
          appendOutput('log.fetchRemote.indexTop', { list: first.join(', ') })
        }
        appendOutput('log.fetchRemote.addedFiles', { list: (added.length ? added.join(', ') : '<なし>') })
      } catch (e) {
        appendOutput('error.fetchRemote.indexException', { err: String(e) })
      }
    } catch (e) {
      appendOutput('error.fetchRemote.failed', { err: String(e) })
    }
    appendTrace('trace.empty')
  })



  const resolveConflictBtn = el('resolveConflict') as HTMLButtonElement
  resolveConflictBtn.addEventListener('click', async () => {
    const path = (prompt(t('prompt.resolveConflict')) || '').trim()
    if (!path) return
    if (!currentVfs) { appendOutput('error.fetchRemote.vfsNotInit'); return }
    try {
      if (typeof currentVfs.resolveConflict === 'function') {
        appendTrace('trace.raw', { msg: '//' })
        appendTrace('trace.raw', { msg: `const ok = await currentVfs.resolveConflict(${path})` })
        const ok = await currentVfs.resolveConflict(path)
        appendTrace('trace.raw', { msg: 'ok => ' + JSON.stringify(ok) })
        if (ok) appendOutput('log.resolveConflict.succeeded', { path })
        else appendOutput('log.resolveConflict.notFoundOrFailed', { path })
      } else {
        appendOutput('error.resolveConflict.notImplemented')
      }
    } catch (e) {
      appendOutput('error.resolveConflict.failed', { err: String(e) })
    }
    appendTrace('trace.empty')
  })

  const revertChangeBtn = el('revertChange') as HTMLButtonElement
  if (revertChangeBtn) {
    revertChangeBtn.addEventListener('click', async () => {
      const path = (prompt(t('prompt.revertChange')) || '').trim()
      if (!path) return
      if (!currentVfs) { appendOutput('error.fetchRemote.vfsNotInit'); return }
      try {
        const backend = (currentVfs as any).backend
        if (!backend || typeof backend.deleteBlob !== 'function') {
          appendOutput('error.revertChange.backendNoDelete')
          return
        }
        appendOutput('log.revertChange.deleting', { path })
        try {
          await backend.deleteBlob(path, 'workspace')
          appendTrace('trace.raw', { msg: '//' })
          appendTrace('trace.raw', { msg: `await backend.deleteBlob(${path}, 'workspace')` })
        } catch (e) {
          appendOutput('error.revertChange.backendException', { err: String(e) })
        }

        // Reload VFS index/state so UI reflects the reverted state
        try {
          if (typeof currentVfs.init === 'function') {
            await currentVfs.init()
            appendTrace('trace.raw', { msg: 'await currentVfs.init()' })
          }
        } catch (e) {
          appendOutput('error.revertChange.vfsReinitFailed', { err: String(e) })
        }

        // Show current content (workspace or base)
        try {
          const content = await currentVfs.readFile(path)
          const snippet = content === null ? t('ui.empty') : (typeof content === 'string' ? content.slice(0, 400).replace(/\r?\n/g, '\\n') : String(content))
          appendOutput('log.revertChange.done', { path, snippet })
        } catch (e) {
          appendOutput('error.revertChange.readFailed', { err: String(e) })
        }
      } catch (e) {
        appendOutput('error.revertChange.failed', { err: String(e) })
      }
      appendTrace('trace.empty')
    })
  }

  const remoteChangesBtn = el('remoteChanges') as HTMLButtonElement
  remoteChangesBtn.addEventListener('click', async () => {
    appendOutput('log.remoteChanges.start')
    if (!currentVfs) { appendOutput('error.remoteChanges.vfsNotInit'); return }
    try {
      if (!currentVfs || typeof currentVfs.getRemoteDiffs !== 'function') {
        appendOutput('error.remoteChanges.notImplemented');
        return
      }
      appendTrace('trace.raw', { msg: '//' })
      appendTrace('trace.raw', { msg: `const res = await currentVfs.getRemoteDiffs()` })
    const res = await currentVfs.getRemoteDiffs()
    appendTrace('trace.raw', { msg: 'res => ' + JSON.stringify(res) })
      const diffs: string[] = res?.diffs || []
      appendOutput('log.remoteChanges.count', { count: diffs.length })
      if (diffs.length > 0) appendOutput(diffs.join('\n'))
    } catch (e) {
      appendOutput('error.remoteChanges.failed', { err: String(e) })
    }
    appendTrace('trace.empty')
  })

  const addLocalFileBtn = el('addLocalFile') as HTMLButtonElement
  addLocalFileBtn.addEventListener('click', async () => {
    if (!currentVfs) { appendOutput('error.fetchRemote.vfsNotInit'); return }
    const path = prompt(t('prompt.addLocalFile.name'))
    if (!path) return
    const content = prompt(t('prompt.addLocalFile.content'), 'hello') || ''
    try {
      appendTrace('trace.raw', { msg: '// ファイルの書き込み' })
      appendTrace('trace.raw', { msg: `await currentVfs.writeFile(${path}, ${content})` })
      await currentVfs.writeFile(path, content)
      appendOutput('log.addLocalFile.added', { path, content })
    } catch (e) { appendOutput('error.addLocalFile.failed', { err: String(e) }) }
    appendTrace('trace.empty')
  })

  const localChangesBtn = el('localChanges') as HTMLButtonElement
  localChangesBtn.addEventListener('click', async () => {
    if (!currentVfs) { appendOutput('error.localChanges.vfsNotInit'); return }
    try {
      appendTrace('trace.raw', { msg: '// ローカルのチェンジセット取得' })
      appendTrace('trace.raw', { msg: 'const changes = await currentVfs.getChangeSet()' })
      const changes = await currentVfs.getChangeSet()
      appendTrace('trace.raw', { msg: 'changes => ' + JSON.stringify(changes) })
      appendOutput('log.localChanges.list', { json: JSON.stringify(changes, null, 2) })
    } catch (e) { appendOutput('error.localChanges.failed', { err: String(e) }) }
    appendTrace('trace.empty')
  })

  const pushLocalBtn = el('pushLocal') as HTMLButtonElement
  pushLocalBtn.addEventListener('click', async () => {
    appendOutput('log.pushLocal.start')
    if (!currentVfs) { appendOutput('error.pushLocal.vfsNotInit'); return }
    if (!(await getCurrentAdapter())) { appendOutput('error.pushLocal.noAdapter'); return }
    try {
      appendTrace('trace.raw', { msg: '// ローカルのチェンジセットをリモートに push' })
      appendTrace('trace.raw', { msg: 'const changes = await currentVfs.getChangeSet()' })
      const changes = await currentVfs.getChangeSet()
      appendTrace('trace.raw', { msg: 'changes => ' + JSON.stringify(changes) })
      if (!changes || changes.length === 0) { appendOutput('log.pushLocal.noChanges'); return }
      appendTrace('trace.raw', { msg: 'const idx = await currentVfs.getIndex()' })
      const idx = await currentVfs.getIndex()
      appendTrace('trace.raw', { msg: 'idx => ' + JSON.stringify(idx) })
      const input = { message: 'Example push from UI' }
      appendTrace('trace.raw', { msg: `const res = await currentVfs.push(${JSON.stringify(input)})` })
      const res = await currentVfs.push(input)
      appendTrace('trace.raw', { msg: 'res => ' + JSON.stringify(res) })
      appendOutput('log.pushLocal.success', { json: JSON.stringify(res) })
    } catch (e) { appendOutput('error.pushLocal.failed', { err: String(e) }) }
    appendTrace('trace.empty')
  })

  // --- Edit / Delete / Rename existing file and push to remote ---
  const editAndPushBtn = el('editAndPush') as HTMLButtonElement
  editAndPushBtn.addEventListener('click', async () => {
    appendOutput('log.editAndPush.start')
    if (!currentVfs) { appendOutput('error.editAndPush.vfsNotInit'); return }
    if (!(await getCurrentAdapter())) { appendOutput('error.editAndPush.noAdapter'); return }
    try {
      const path = (prompt(t('prompt.editAndPush.path')) || '').trim()
      if (!path) return
      appendTrace('trace.raw', { msg: '// 既存ファイルの読み取り' })
      appendTrace('trace.raw', { msg: `const existing = await currentVfs.readFile(${path})` })
      const existing = await currentVfs.readFile(path)
      appendTrace('trace.raw', { msg: 'existing => ' + existing })
      const newContent = prompt(t('prompt.editAndPush.newContent'), existing === null ? '' : String(existing))
      if (newContent === null) return
      appendTrace('trace.raw', { msg: `await currentVfs.writeFile(${path}, ${newContent})` })
      await currentVfs.writeFile(path, newContent)
      appendOutput('log.editAndPush.edited', { path })

    } catch (e) {
      appendOutput('error.editAndPush.failed', { err: String(e) })
    }
    appendTrace('trace.empty')
  })

  const deleteAndPushBtn = el('deleteAndPush') as HTMLButtonElement
  deleteAndPushBtn.addEventListener('click', async () => {
    appendOutput('log.deleteAndPush.start')
    if (!currentVfs) { appendOutput('error.deleteAndPush.vfsNotInit'); return }
    if (!(await getCurrentAdapter())) { appendOutput('error.deleteAndPush.noAdapter'); return }
    try {
      const path = (prompt(t('prompt.deleteAndPush.path')) || '').trim()
      if (!path) return
      const ok = confirm(t('confirm.delete', { path }))
      if (!ok) return
      appendTrace('trace.raw', { msg: '// 既存ファイルの削除' })
      appendTrace('trace.raw', { msg: `await currentVfs.deleteFile(${path})` })
      await currentVfs.deleteFile(path)
      appendOutput('log.deleteAndPush.deleted', { path })

    } catch (e) {
      appendOutput('error.deleteAndPush.failed', { err: String(e) })
    }
    appendTrace('trace.empty')
  })

  const renameBtn = el('renameBtn') as HTMLButtonElement
  renameBtn.addEventListener('click', async () => {
    appendOutput('log.rename.start')
    if (!currentVfs) { appendOutput('error.rename.vfsNotInit'); return }
    if (!(await getCurrentAdapter())) { appendOutput('error.rename.noAdapter'); return }
    try {
      const from = (prompt(t('prompt.rename.from')) || '').trim()
      if (!from) return
      const to = (prompt(t('prompt.rename.to')) || '').trim()
      if (!to) return
      appendTrace('trace.raw', { msg: '// 既存ファイルの名前変更  ' })
      appendTrace('trace.raw', { msg: `await currentVfs.renameFile(${from}, ${to})` })
      await currentVfs.renameFile(from, to)
      appendOutput('log.rename.renamed', { from, to })

    } catch (e) {
      appendOutput('error.rename.failed', { err: String(e) })
    }
    appendTrace('trace.empty')
  })

  const showSnapshotBtn = el('showSnapshot') as HTMLButtonElement
  showSnapshotBtn.addEventListener('click', () => {
    ; (async () => {
      try {
        if (!currentVfs) {
          appendOutput('error.showSnapshot.vfsNotInit')
          return
        }
        appendOutput('log.showSnapshot.start')
        try {
          const paths: string[] = await currentVfs.readdir('.')

          appendTrace('trace.raw', { msg: '// スナップショット内のパス一覧を取得' })
          appendTrace('trace.raw', { msg: "const paths = await currentVfs.readdir('.')" })
          appendTrace('trace.raw', { msg: 'paths => ' + JSON.stringify(paths) })
            if (!paths || paths.length === 0) {
            appendOutput('log.showSnapshot.noFiles')
            return
          }
          appendOutput('log.showSnapshot.count', { count: paths.length })
          for (const p of paths) {
            appendOutput('log.showSnapshot.fileEntry', { path: p })
          }
        } catch (e) {
          appendOutput('error.showSnapshot.failed', { err: String(e) })
        }
        appendTrace('trace.empty')
      } catch (e) {
        appendOutput('error.showSnapshot.unexpected', { err: String(e) })
      }
    })()
  })

  const showFileContentBtn = el('showFileContent') as HTMLButtonElement
  showFileContentBtn.addEventListener('click', () => {
    ; (async () => {
      try {
        if (!currentVfs) {
          appendOutput('error.showFileContent.vfsNotInit')
          return
        }
        const path = (prompt(t('prompt.showFileContent.path')) || '').trim()
        if (!path) return
        appendOutput('log.showFileContent.start', { path })
        try {
          appendTrace('trace.raw', { msg: `const content = await currentVfs.readFile(${path})` })
          const content = await currentVfs.readFile(path)
          const text = content === null ? t('ui.empty') : (typeof content === 'string' ? content : String(content))
          appendOutput('log.showFileContent.content', { path, content: text })
        } catch (e) {
          appendOutput('error.showFileContent.readFailed', { path, err: String(e) })
        }
        appendTrace('trace.empty')
      } catch (e) {
        appendOutput('error.showFileContent.failed', { err: String(e) })
      }
    })()
  })

  const showConflictContentBtn = el('showConflictContent') as HTMLButtonElement
  showConflictContentBtn.addEventListener('click', () => {
    ; (async () => {
      try {
        if (!currentVfs) {
          appendOutput('error.showConflictContent.vfsNotInit')
          return
        }
        if (typeof currentVfs.readConflict !== 'function') {
          appendOutput('error.showConflictContent.notImplemented')
          return
        }
        const path = (prompt(t('prompt.showConflictContent.path')) || '').trim()
        if (!path) return
        appendOutput('log.showConflictContent.start', { path })
        try {
          appendTrace('trace.raw', { msg: `const content = await currentVfs.readConflict(${path})` })
          const content = await currentVfs.readConflict(path)
          const text = content === null ? t('ui.empty') : (typeof content === 'string' ? content : String(content))
          appendOutput('log.showConflictContent.content', { path, content: text })
        } catch (e) {
          appendOutput('error.showConflictContent.readFailed', { path, err: String(e) })
        }
        appendTrace('trace.empty')
      } catch (e) {
        appendOutput('error.showConflictContent.failed', { err: String(e) })
      }
    })()
  })

  const listFilesRawBtn = el('listFilesRaw') as HTMLButtonElement | null
  const listCommitsBtn = el('listCommits') as HTMLButtonElement | null
  if (listCommitsBtn) {
    listCommitsBtn.addEventListener('click', async () => {
      appendOutput('log.listCommits.start')
      if (!currentVfs) { appendOutput('error.listCommits.vfsNotInit'); return }
      try {
        const branch = (branchInput && branchInput.value) ? branchInput.value.trim() : 'main'
        const query: any = { ref: branch, perPage: 20, page: 1 }
        appendTrace('trace.raw', { msg: '// VirtualFS.listCommits を呼び出します' })
        appendTrace('trace.raw', { msg: 'const page = await currentVfs.listCommits(' + JSON.stringify(query) + ')' })
        if (typeof currentVfs.listCommits !== 'function') {
          appendOutput('error.listCommits.notImplemented')
          return
        }
        const page = await currentVfs.listCommits(query)
        appendTrace('trace.raw', { msg: 'listCommits => ' + JSON.stringify(page) })
        const p: any = page || {}
        // support both 'items' (examples returning items) and 'commits' shape
        const commits = Array.isArray(p.items) ? p.items : Array.isArray(p.commits) ? p.commits : []
        appendOutput('log.listCommits.count', { count: commits.length })
        if (commits.length > 0) {
          // present concise summary per commit for readability
          const sample = commits.slice(0, 50).map((c: any) => {
            const m = (c.message || '').toString().split(/\r?\n/)[0]
            const date = c.date || c.created_at || ''
            const author = c.author || c.author_name || c.author?.name || ''
            return `${c.sha || c.id || c.short_id || '<no-sha>'}  ${date}  ${author}  ${m}`
          })
          appendOutput(sample.join('\n'))
          if (commits.length > 50) appendOutput('log.listCommits.more', { n: commits.length - 50 })
        }
        const nextPage = p.nextPage ?? p.next ?? p.xNextPage ?? p['x-next-page']
        const lastPage = p.lastPage ?? p.last ?? p.xTotalPages ?? p['x-total-pages']
        // update UI paging state
        commitCurrentPage = query.page || 1
        commitLastPage = lastPage ? Number(lastPage) : null
        appendOutput('log.listCommits.paging', { next: (nextPage ? String(nextPage) : '<none>'), last: (lastPage ? String(lastPage) : '<none>') })
      } catch (e) {
        appendOutput('error.listCommits.failed', { err: String(e) })
      }
      appendTrace('trace.empty')
    })
  }

  const nextCommitsPageBtn = el('nextCommitsPage') as HTMLButtonElement | null
  if (nextCommitsPageBtn) {
    nextCommitsPageBtn.addEventListener('click', async () => {
      appendOutput('log.nextCommitsPage.start')
      if (!currentVfs) { appendOutput('error.nextCommitsPage.vfsNotInit'); return }
      try {
        // determine next page to request
        const branch = (branchInput && branchInput.value) ? branchInput.value.trim() : 'main'
        const nextPage = (commitLastPage !== null && typeof commitLastPage === 'number') ? (commitCurrentPage < commitLastPage ? commitCurrentPage + 1 : null) : commitCurrentPage + 1
        if (!nextPage) { appendOutput('error.nextCommitsPage.noNext'); return }
        const query: any = { ref: branch, perPage: 20, page: nextPage }
        appendTrace('trace.raw', { msg: '// VirtualFS.listCommits (next page) を呼び出します' })
        const page = await currentVfs.listCommits(query)
        appendTrace('trace.raw', { msg: 'listCommits(next) => ' + JSON.stringify(page) })
        const p: any = page || {}
        const commits = Array.isArray(p.items) ? p.items : Array.isArray(p.commits) ? p.commits : []
        appendOutput('log.nextCommitsPage.count', { count: commits.length })
        if (commits.length > 0) {
          const sample = commits.slice(0, 50).map((c: any) => {
            const m = (c.message || '').toString().split(/\r?\n/)[0]
            const date = c.date || c.created_at || ''
            const author = c.author || c.author_name || c.author?.name || ''
            return `${c.sha || c.id || c.short_id || '<no-sha>'}  ${date}  ${author}  ${m}`
          })
          appendOutput(sample.join('\n'))
          if (commits.length > 50) appendOutput('log.listCommits.more', { n: commits.length - 50 })
        }
        const newNextPage = p.nextPage ?? p.next ?? p.xNextPage ?? p['x-next-page']
        const newLastPage = p.lastPage ?? p.last ?? p.xTotalPages ?? p['x-total-pages']
        // update state
        commitCurrentPage = query.page || commitCurrentPage
        commitLastPage = newLastPage ? Number(newLastPage) : commitLastPage
        appendOutput('log.nextCommitsPage.current', { current: String(commitCurrentPage), last: (commitLastPage ? String(commitLastPage) : '<none>') })
      } catch (e) {
        appendOutput('error.nextCommitsPage.failed', { err: String(e) })
      }
      appendTrace('trace.empty')
    })
  }

  const listBranchesBtn = el('listBranches') as HTMLButtonElement | null
  if (listBranchesBtn) {
    listBranchesBtn.addEventListener('click', async () => {
      appendOutput('log.listBranches.start')
      if (!currentVfs) { appendOutput('error.listBranches.vfsNotInit'); return }
      try {
        if (typeof currentVfs.listBranches !== 'function') {
          appendOutput('error.listBranches.notImplemented')
          return
        }
        const perPage = 100
        const page = 1
        const query: any = { perPage, page }
        appendTrace('trace.raw', { msg: '// VirtualFS.listBranches を呼び出します' })
        appendTrace('trace.raw', { msg: 'const page = await currentVfs.listBranches(' + JSON.stringify(query) + ')' })
        const res = await currentVfs.listBranches(query)
        appendTrace('trace.raw', { msg: 'listBranches => ' + JSON.stringify(res) })
        const p: any = res || {}
        const items = Array.isArray(p.items) ? p.items : Array.isArray(p.branches) ? p.branches : []
        appendOutput('log.listBranches.count', { count: items.length })
        for (const b of items) {
          try {
            const name = b && b.name ? b.name : (b && b.ref ? b.ref : '<unknown>')
            const flags = []
            if (b && b.isDefault) flags.push(t('branch.flag.default'))
            if (b && b.protected) flags.push(t('branch.flag.protected'))
            appendOutput(`- ${name}${flags.length ? ' (' + flags.join(', ') + ')' : ''}`)
          } catch (e) { appendTrace('trace.raw', { msg: '[listBranches] per-item error: ' + String(e) }) }
        }
        const nextPage = p.nextPage ?? p.next ?? p.xNextPage ?? p['x-next-page']
        const lastPage = p.lastPage ?? p.last ?? p.xTotalPages ?? p['x-total-pages']
        appendOutput('log.listBranches.paging', { next: (nextPage ? String(nextPage) : '<none>'), last: (lastPage ? String(lastPage) : '<none>') })
      } catch (e) {
        appendOutput('error.listBranches.failed', { err: String(e) })
      }
      appendTrace('trace.empty')
    })
  }

  const createBranchBtn = el('createBranchBtn') as HTMLButtonElement | null
  if (createBranchBtn) {
    createBranchBtn.addEventListener('click', async () => {
      appendOutput('log.createBranch.start')
      if (!currentVfs) { appendOutput('error.createBranch.vfsNotInit'); return }
      try {
        if (typeof currentVfs.createBranch !== 'function') {
          appendOutput('error.createBranch.notImplemented')
          return
        }
        const name = (prompt(t('prompt.createBranch.name'), 'new-branch') || '').trim()
        if (!name) return
        const from = (prompt(t('prompt.createBranch.fromRef'), '') || '').trim()
        const input: any = { name }
        if (from) input.fromRef = from
        appendTrace('trace.raw', { msg: '// VirtualFS.createBranch を呼び出します' })
        appendTrace('trace.raw', { msg: 'const res = await currentVfs.createBranch(' + JSON.stringify(input) + ')' })
        const res = await currentVfs.createBranch(input)
        appendTrace('trace.raw', { msg: 'createBranch => ' + JSON.stringify(res) })
        appendOutput('log.createBranch.success', { name: (res && res.name ? res.name : JSON.stringify(res)) })
        if (res && res.sha) appendOutput('log.createBranch.sha', { sha: String(res.sha) })
        if (res && res.ref) appendOutput('log.createBranch.ref', { ref: String(res.ref) })
      } catch (e) {
        appendOutput('error.createBranch.failed', { err: String(e) })
      }
      appendTrace('trace.empty')
    })
  }

  if (listFilesRawBtn) {
    listFilesRawBtn.addEventListener('click', async () => {
      appendOutput('log.listFilesRaw.start')
      if (!currentVfs) { appendOutput('error.listFilesRaw.vfsNotInit'); return }
      try {
        if (typeof currentVfs.listFilesRaw === 'function') {
          appendTrace('trace.raw', { msg: '// VirtualFS の listFilesRaw() を実行' })
          appendTrace('trace.raw', { msg: 'const files = await currentVfs.listFilesRaw()' })
          const files = await currentVfs.listFilesRaw()
          appendTrace('trace.raw', { msg: 'files => ' + JSON.stringify(files) })
          const count = Array.isArray(files) ? files.length : 0
          appendOutput('log.listFilesRaw.count', { count })
          if (count > 0) appendOutput(JSON.stringify(files, null, 2))
        } else {
          // Try backend.listFilesRaw as a fallback
          const backend = (currentVfs as any).backend
          if (backend && typeof backend.listFilesRaw === 'function') {
            appendTrace('trace.raw', { msg: 'const files = await backend.listFilesRaw()' })
            const files = await backend.listFilesRaw()
            appendTrace('trace.raw', { msg: 'files => ' + JSON.stringify(files) })
            const count = Array.isArray(files) ? files.length : 0
            appendOutput('log.listFilesRaw.backendCount', { count })
            if (count > 0) appendOutput(JSON.stringify(files, null, 2))
          } else {
            appendOutput('error.listFilesRaw.notImplemented')
          }
        }
      } catch (e) {
        appendOutput('error.listFilesRaw.failed', { err: String(e) })
      }

      appendTrace('trace.empty')
    })
  }
}

// 自動起動
main().catch((e) => console.error(e))
