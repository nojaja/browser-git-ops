/*
 GitLabからスナップショットを取得し、ファイルを追加→push、削除→pushする統合テスト

 必要なローカルサービス / スクリプト:
 - examples 開発サーバを起動しておく (例: examples フォルダで `npm run start` を実行し http://localhost:8080 を提供)
 - テスト用 GitLab エンドポイント (例: ローカルのモックサーバ http://localhost:8929) または実運用の GitLab
 - このリポジトリルートに `test/conf/gitlab.config.json` が存在すること
 - Playwright がインストール済みであること (`npm i -D @playwright/test`)

 実行例 (PowerShell):
 ```powershell
 # examples サーバを起動
 cd examples ; npm run start

 # 別ターミナルでテスト実行 (ヘッデッドでデバッグ)
 $env:PWDEBUG=1 ; npx playwright test examples/test/e2e/gitlabFetchAddPushDeletePush.spec.ts --headed --workers=1
 ```
*/

import { test, expect } from '@playwright/test'
import fs from 'fs/promises'
import path from 'path'

// セレクタはアプリに合わせて調整してください
const SELECTORS = {
  repoInput: '#repoInput',
  tokenInput: '#tokenInput',
  platform: '#platformSelect',
  connectBtn: '#connectBtn',
  connectOpfsBtn: '#connectOpfs',
  useIndexedDbBtn: '#connectIndexedDb',
  fetchBtn: '#fetchRemote',
  newFileBtn: '#addLocalFile',
  pushBtn: '#pushLocal',
  deleteBtn: '#deleteAndPush',
  output: '#output'
}

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080'

test.describe('GitLab fetch→add→push→delete→push シナリオ', () => {
  test('GitLab スナップショット取得、ファイル追加・push、削除・push の検証', async ({ page }) => {
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

    // アプリに移動して接続情報を入力
    await page.goto(BASE_URL)

    // ダイアログ応答 (ファイル作成時の prompt を想定)
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        // 新規ファイル名として tt2.txt を入力
        await dialog.accept('tt2.txt')
      } else {
        await dialog.accept()
      }
    })

    // リポジトリ情報をフォームに入力
    await page.fill(SELECTORS.repoInput, repoUrl)
    await page.fill(SELECTORS.tokenInput, token)
    await page.selectOption(SELECTORS.platform, 'gitlab')

    // 接続開始
    await page.click(SELECTORS.connectBtn)
    await expect(page.locator(SELECTORS.output)).toContainText('接続を試みます...')

    // OPFS 接続 (なければ IndexedDb へフォールバック)
    // まず OPFS 接続ボタンを試す
    try {
      await page.click(SELECTORS.connectOpfsBtn)
    } catch (e) {
      // ボタンが無ければ IndexedDb ボタンを試す
      try {
        await page.click(SELECTORS.useIndexedDbBtn)
      } catch (e2) {
        // いずれの操作もできなければ失敗させる
        throw new Error('ストレージ接続ボタンが見つかりません。UI セレクタを確認してください。')
      }
    }

    // VirtualFS 初期化完了を待つ
    await expect(page.locator(SELECTORS.output)).toContainText('VirtualFS.init()')

    // リモートからスナップショットを取得（pull 相当）
    await page.click(SELECTORS.fetchBtn)
    await expect(page.locator(SELECTORS.output)).toContainText('pull 完了')

    // 新規ファイル追加 --- UI が prompt を出す想定でハンドリング済み
    await page.click(SELECTORS.newFileBtn)
    await expect(page.locator(SELECTORS.output)).toContainText('ローカルにファイルを追加しました: tt2.txt')

    // 追加した変更を push
    await page.click(SELECTORS.pushBtn)
    await expect(page.locator(SELECTORS.output)).toContainText('push 成功')

    // ファイル削除（UI上の削除ボタンを押す想定）
    await page.click(SELECTORS.deleteBtn)
    await expect(page.locator(SELECTORS.output)).toContainText('ローカルで削除しました')

    // 削除のチェンジセットを push
    await page.click(SELECTORS.pushBtn)
    await expect(page.locator(SELECTORS.output)).toContainText('push 成功')
  })
})
