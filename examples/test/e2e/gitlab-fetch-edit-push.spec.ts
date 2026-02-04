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


  await page.goto('http://127.0.0.1:8080/?lang=ja')
  await page.waitForSelector('#repoInput')

  const out = page.locator('#output')


  page.once('dialog', async (dialog) => {
    console.log(`Dialog message: ${dialog.message()}`);
    await dialog.accept('GitLab_test01');
  })
  await page.click('#connectOpfs')

  //select(#opfsRootsList)のoption(value="GitLab_test01")を選択する
  await page.selectOption('#opfsRootsList', 'GitLab_test01')
  await page.waitForTimeout(700)

  // リポジトリ情報をフォームに入力
  await page.fill('#repoInput', repoUrl)
  await page.fill('#tokenInput', cfg.token)
  // Ensure platform is set to gitlab to avoid heuristics ambiguity
  await page.selectOption('#platformSelect', 'gitlab')
  await page.click('#connectBtn')
  await expect(out).toContainText('接続を試みます...')
  await expect(out).toContainText('入力: repo=')
  await expect(out).toContainText('GitLabAdapter 作成')
  await page.waitForTimeout(500)


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
