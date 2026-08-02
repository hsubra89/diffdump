export const SITE_NAME = 'Diffdump'
export const SITE_ORIGIN = 'https://diffdump.com'
export const SOCIAL_IMAGE_URL = `${SITE_ORIGIN}/og.png`
export const SOURCE_REPOSITORY_URL = 'https://github.com/hsyntax/diffdump'

export type IndexablePagePath =
  '/' | '/github-diff-viewer' | '/share-git-diff' | '/docs/cli'

export const INDEXABLE_PAGE_PATHS: readonly IndexablePagePath[] = [
  '/',
  '/github-diff-viewer',
  '/share-git-diff',
  '/docs/cli',
]

type OpenGraphType = 'article' | 'website'

type PageSeo = {
  description: string
  ogType?: OpenGraphType
  path: IndexablePagePath
  title: string
}

type ArticleSeo = PageSeo & {
  dateModified: string
  datePublished: string
}

type SocialPageSeo = Pick<PageSeo, 'description' | 'title'>

export function absoluteSiteUrl(path: IndexablePagePath): string {
  return new URL(path, SITE_ORIGIN).href
}

export function createPageHead({
  description,
  ogType = 'website',
  path,
  title,
}: PageSeo) {
  const url = absoluteSiteUrl(path)

  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { name: 'robots', content: 'index, follow' },
      ...createSocialMeta({ description, ogType, title }),
      { property: 'og:url', content: url },
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}

export function createNoIndexPageHead({ description, title }: SocialPageSeo) {
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { name: 'robots', content: 'noindex, nofollow' },
      ...createSocialMeta({ description, title }),
    ],
  }
}

function createSocialMeta({
  description,
  ogType = 'website',
  title,
}: SocialPageSeo & { ogType?: OpenGraphType }) {
  return [
    { property: 'og:type', content: ogType },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: SOCIAL_IMAGE_URL },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: SOCIAL_IMAGE_URL },
  ]
}

export function createWebApplicationStructuredData(description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: absoluteSiteUrl('/'),
    description,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    codeRepository: SOURCE_REPOSITORY_URL,
    featureList: [
      'Complete GitHub pull request review flow with inline comments, approvals, and change requests',
      'Automatic Source, Tests, Docs, and Other file categorization',
      'GitHub stacked pull request navigation',
      'GitHub pull request, commit, and comparison review',
      'Unified and split diff layouts',
      'Syntax-highlighted multi-file diffs',
      'Unlisted 24-hour diff share links',
    ],
  }
}

export function createTechArticleStructuredData({
  dateModified,
  datePublished,
  description,
  path,
  title,
}: ArticleSeo) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    image: SOCIAL_IMAGE_URL,
    datePublished,
    dateModified,
    url: absoluteSiteUrl(path),
    mainEntityOfPage: absoluteSiteUrl(path),
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: absoluteSiteUrl('/'),
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: absoluteSiteUrl('/'),
    },
  }
}
