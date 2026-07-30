import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  INDEXABLE_PAGE_PATHS,
  SOCIAL_IMAGE_URL,
  createNoIndexPageHead,
  createPageHead,
  createTechArticleStructuredData,
} from './seo'
import { createSitemapXml } from './sitemap'

describe('SEO metadata', () => {
  it('uses absolute canonical and social URLs', () => {
    const head = createPageHead({
      title: 'Share a Git Diff | Diffdump',
      description: 'Create an expiring diff share link.',
      path: '/share-git-diff',
    })

    expect(head.links).toContainEqual({
      rel: 'canonical',
      href: 'https://diffdump.com/share-git-diff',
    })
    expect(head.meta).toContainEqual({
      property: 'og:url',
      content: 'https://diffdump.com/share-git-diff',
    })
    expect(head.meta).toContainEqual({
      property: 'og:image',
      content: SOCIAL_IMAGE_URL,
    })
  })

  it('keeps social cards on non-indexable share routes', () => {
    const head = createNoIndexPageHead({
      title: 'Shared diff — Diffdump',
      description: 'Review a shared code diff.',
    })

    expect(head.meta).toContainEqual({
      name: 'robots',
      content: 'noindex, nofollow',
    })
    expect(head.meta).toContainEqual({
      property: 'og:title',
      content: 'Shared diff — Diffdump',
    })
    expect(head.meta).toContainEqual({
      property: 'og:image',
      content: SOCIAL_IMAGE_URL,
    })
    expect(head.meta).toContainEqual({
      name: 'twitter:card',
      content: 'summary_large_image',
    })
  })

  it('includes publication dates in guide structured data', () => {
    const article = createTechArticleStructuredData({
      title: 'Share a Git Diff | Diffdump',
      description: 'Create an expiring diff share link.',
      path: '/share-git-diff',
      datePublished: '2026-07-29',
      dateModified: '2026-07-29',
    })

    expect(article).toMatchObject({
      '@type': 'TechArticle',
      datePublished: '2026-07-29',
      dateModified: '2026-07-29',
      image: SOCIAL_IMAGE_URL,
    })
  })
})

describe('sitemap', () => {
  it('contains only the permanent, indexable pages', () => {
    const sitemap = createSitemapXml()

    for (const path of INDEXABLE_PAGE_PATHS) {
      const suffix = path === '/' ? '/' : path
      expect(sitemap).toContain(`<loc>https://diffdump.com${suffix}</loc>`)
    }

    expect(sitemap).not.toContain('/view/')
    expect(sitemap).not.toContain('/github?')
    expect(sitemap).not.toContain('<loc>https://diffdump.com/d</loc>')
  })
})

describe('robots.txt', () => {
  it('does not block indexable guide paths with broad prefixes', () => {
    const robots = readFileSync('public/robots.txt', 'utf8')

    expect(robots).toContain('Disallow: /d$')
    expect(robots).toContain('Disallow: /d?')
    expect(robots).toContain('Disallow: /github$')
    expect(robots).toContain('Disallow: /github?')
    expect(robots).not.toMatch(/^Disallow: \/d$/m)
    expect(robots).not.toMatch(/^Disallow: \/github$/m)
  })
})
