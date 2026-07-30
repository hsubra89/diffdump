import {
  INDEXABLE_PAGE_PATHS,
  absoluteSiteUrl,
  type IndexablePagePath,
} from './seo'

export function createSitemapXml(
  paths: readonly IndexablePagePath[] = INDEXABLE_PAGE_PATHS,
): string {
  const urls = paths
    .map(
      (path) => `  <url><loc>${escapeXml(absoluteSiteUrl(path))}</loc></url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character] ?? character,
  )
}
