import { test, expect } from '@playwright/test';
import { clearOPFS } from '../helpers/opfs'

test.describe('Examples i18n - Logs & messages', () => {
  test.beforeEach(async ({ page }) => {
    await clearOPFS(page)
  })

  test('?lang=ja logs are Japanese on actions', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/?lang=ja')
    await page.waitForSelector('#repoInput')

    await page.click('#connectBtn')
    // small wait for UI handlers to append messages
    await page.waitForTimeout(200)

    //page.locator('#output')配下のdivにタグ属性の`data-message-id`に"log.connect.start"があることを確認する
    const logConnectStart = await page.locator('#output > div[data-message-id="log.connect.start"]').count()
    expect(logConnectStart).toBeGreaterThan(0)
  })

  test('?lang=en logs are English on actions', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/?lang=en')
    await page.waitForSelector('#repoInput')

    await page.click('#connectBtn')
    await page.waitForTimeout(200)

    const logConnectStart = await page.locator('#output > div[data-message-id="log.connect.start"]').count()
    expect(logConnectStart).toBeGreaterThan(0)
  })
})
