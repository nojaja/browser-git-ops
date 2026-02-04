import { test, expect } from '@playwright/test';
import { clearOPFS } from './helpers/opfs'
import fs from 'fs/promises'
import path from 'path'

test.describe('Examples UI smoke', () => {
  test.beforeEach(async ({ page }) => {
    await clearOPFS(page)
  })
  test('connect, initVfs, listAdapters', async ({ page }) => {
    const messages: string[] = []
    page.on('console', (msg) => messages.push(`${msg.type()}: ${msg.text()}`))

    await page.goto('http://127.0.0.1:8080')
    await page.waitForSelector('#repoInput')

    page.once('dialog', async (dialog) => {
      console.log(`Dialog message: ${dialog.message()}`);
      await dialog.accept('GitLab_test01');
    })
    await page.click('#connectOpfs')

    //select(#opfsRootsList)のoption(value="GitLab_test01")を選択する
    await page.selectOption('#opfsRootsList', 'GitLab_test01')
    await page.waitForTimeout(700)

    // load GitLab config (projectId/token/host) from test/conf/gitlab.config.json
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
        // ignore and try next candidate
      }
    }
    if (!cfg) throw new Error('test/conf/gitlab.config.json が見つかりません')
    const repoUrl = `${cfg.host || ''}/${cfg.projectId}`.replace(/([^:])\/\//g, '$1/')
    await page.fill('#repoInput', repoUrl)
    await page.fill('#tokenInput', cfg.token)
    // Ensure platform is set to gitlab to avoid heuristics ambiguity
    await page.selectOption('#platformSelect', 'gitlab')
    await page.click('#connectBtn')
    await page.waitForTimeout(500)

    await page.click('#listAdapters')
    await page.waitForTimeout(300)

    const out = await page.locator('#output')
    //outの配下のdivのdata-message-idのリストを取得してexpectで確認する
    const messageIds = await out.locator('div[data-message-id]').evaluateAll(divs => divs.map(div => div.getAttribute('data-message-id')))
    expect(messageIds).toContain('log.github.adapterCreated')
    expect(messageIds).toContain('log.vfs.createdShort')
  })
})
