import { test, expect } from '@playwright/test';
import { clearOPFS } from '../helpers/opfs'

test.describe('Examples i18n - UI labels', () => {
  test.beforeEach(async ({ page }) => {
    await clearOPFS(page)
  })

  test('?lang=ja shows Japanese UI', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/?lang=ja')
    await page.waitForSelector('#repoInput')

    const h1 = await page.locator('h1').innerText()
    expect(h1).toContain('サンプル')

    const htmlLang = await page.evaluate(() => document.documentElement.lang)
    expect(htmlLang).toBe('ja')

    const connectText = await page.locator('#connectBtn').innerText()
    expect(connectText).toMatch(/接続|更新|接続設定/)

    const opfsDelete = await page.locator('#deleteOpfs').innerText()
    expect(opfsDelete).toContain('削除')
  })

  test('?lang=en shows English UI', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/?lang=en')
    await page.waitForSelector('#repoInput')

    const h1 = await page.locator('h1').innerText()
    expect(h1).toContain('Sample')

    const htmlLang = await page.evaluate(() => document.documentElement.lang)
    expect(htmlLang).toBe('en')

    const connectText = await page.locator('#connectBtn').innerText()
    expect(connectText.toLowerCase()).toContain('connect')

    const opfsDelete = await page.locator('#deleteOpfs').innerText()
    expect(opfsDelete.toLowerCase()).toContain('delete')
  })
})
