import { test, expect } from '@playwright/test'
import fs from 'fs/promises'
import path from 'path'

test('GitLabアダプタ E2E: リモート取得 → 編集 → プッシュの一連フロー（実アダプタ）', async ({ page }) => {
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

  // Navigate to examples page with GET params so UI pre-fills
  await page.goto(`http://127.0.0.1:8080/?repo=${encodeURIComponent(repoUrl)}&token=${encodeURIComponent(token)}&platform=gitlab`)
  await page.waitForSelector('#repoInput')

  const out = page.locator('#output')

  // Connect: should create GitLabAdapter
  await page.click('#connectBtn')
  await expect(out).toContainText('接続を試みます...')
  await expect(out).toContainText('入力: repo=')
  await expect(out).toContainText('GitLabAdapter 作成')

  // Try Opfs first; if not available, fallback to IndexedDb
  await page.click('#connectOpfs')
  // Wait for either success or a message indicating Opfs missing
  await page.waitForTimeout(500)
  const outText = await out.innerText()
  if (outText.includes('バンドルに OpfsStorage が含まれていません') || outText.includes('OpfsStorage 接続で例外')) {
    // fallback
    await page.click('#connectIndexedDb')
    await page.waitForTimeout(700)
    await expect(out).toContainText('VirtualFS を作成し IndexedDbStorage を接続しました')
    await expect(out).toContainText('VirtualFS.init() 実行済み (IndexedDbStorage)')
  } else {
    await expect(out).toContainText('VirtualFS を作成し OpfsStorage を接続しました')
    await expect(out).toContainText('VirtualFS.init() 実行済み')
  }

  // Fetch remote snapshot (real network calls to configured host)
  await page.click('#fetchRemote')
  // Wait longer for network operations
  await page.waitForTimeout(2000)
  await expect(out).toContainText('リモートスナップショットを取得します...')
  // The following expectations depend on the remote repository contents; check general success markers
  await expect(out).toContainText('pull 完了')

  // Prepare dialog handling for editAndPush
  page.on('dialog', async (dialog) => {
    const msg = dialog.message()
    if (msg.includes('編集するファイルのパス')) {
      await dialog.accept('tt1.txt')
    } else if (msg.includes('新しいファイル内容')) {
      await dialog.accept('aaaaaa')
    } else {
      await dialog.dismiss()
    }
  })

  // Edit existing file
  await page.click('#editAndPush')
  await page.waitForTimeout(500)
  await expect(out).toContainText('既存ファイルの編集 & push を開始します...')
  await expect(out).toContainText('ローカル編集しました:')

  // Push
  await page.click('#pushLocal')
  await page.waitForTimeout(2000)
  await expect(out).toContainText('ローカルのチェンジセットをリモートに push します...')
  await expect(out).toContainText('push 成功')
})
