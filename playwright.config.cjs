/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: 'dist/test/e2e',
  timeout: 30 * 1000,
  retries: 0,
  use: {
    headless: true,
  },
}
module.exports = config
