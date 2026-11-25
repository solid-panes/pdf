// Prints tools/sample.html to samples/solid-panes.pdf with headless Chromium.
//   node tools/sample-pdf.mjs [path to playwright's index.mjs]   (default: the playwright package)
import { fileURLToPath, pathToFileURL } from 'node:url'
const { chromium } = await import(process.argv[2] || 'playwright')
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(pathToFileURL(here('sample.html')).href)
await page.evaluate(() => document.fonts.ready)
await page.pdf({ path: here('../samples/solid-panes.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true })
await browser.close()
