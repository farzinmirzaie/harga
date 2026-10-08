// One-off: render the app icons (PNG) from the favicon design, for the web app manifest and iOS.
//   node tools/icons.mjs   writes icons/*.png. Needs Playwright with Chromium.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright')

// Same mark as the favicon in index.html: a yellow dot on the dark brand colour.
// "full" fills the square edge to edge (maskable and Apple icons, which the OS crops); "round" has its own corners.
const svg = (size, full) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${full ? 0 : 7}" fill="#0E1210"/><circle cx="16" cy="16" r="7" fill="#FFD23F"/></svg>`
const ICONS = [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [name, size, full] of ICONS) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>*{margin:0}body{background:transparent}</style>${svg(size, full)}`)
  await page.locator('svg').screenshot({ path: `icons/${name}`, omitBackground: true })
  console.log(`icons/${name}`)
}
await browser.close()
