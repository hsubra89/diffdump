import { readdir, readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const assetDirectory = new URL('../dist/client/assets/', import.meta.url)
const budgets = [
  {
    label: 'core diff viewer',
    pattern: /^diff-viewer-[A-Za-z0-9_-]+\.js$/,
    maxGzipBytes: 230 * 1024,
  },
  {
    label: 'deferred file picker',
    pattern: /^diff-file-picker-[A-Za-z0-9_-]+\.js$/,
    maxGzipBytes: 75 * 1024,
  },
]

const assetNames = await readdir(assetDirectory)
let failed = false

for (const budget of budgets) {
  const matches = assetNames.filter((name) => budget.pattern.test(name))

  if (matches.length !== 1) {
    console.error(
      `Expected one ${budget.label} chunk, found ${matches.length}: ${matches.join(', ') || 'none'}`,
    )
    failed = true
    continue
  }

  const [assetName] = matches
  const source = await readFile(new URL(assetName, assetDirectory))
  const gzipBytes = gzipSync(source).byteLength
  const actual = formatKiB(gzipBytes)
  const limit = formatKiB(budget.maxGzipBytes)

  if (gzipBytes > budget.maxGzipBytes) {
    console.error(`✗ ${budget.label}: ${actual} gzip exceeds ${limit}`)
    failed = true
  } else {
    console.log(`✓ ${budget.label}: ${actual} gzip (budget ${limit})`)
  }
}

if (failed) {
  console.error(
    'Run `pnpm analyze` to inspect the regression before changing a budget.',
  )
  process.exitCode = 1
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}
