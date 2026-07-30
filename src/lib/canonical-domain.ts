import { SITE_ORIGIN } from './seo'

const canonicalSiteUrl = new URL(SITE_ORIGIN)
const WWW_HOSTNAME = `www.${canonicalSiteUrl.hostname}`

export function getCanonicalRedirect(requestUrl: string): Response | undefined {
  const url = new URL(requestUrl)

  if (url.hostname !== WWW_HOSTNAME) {
    return undefined
  }

  url.protocol = canonicalSiteUrl.protocol
  url.host = canonicalSiteUrl.host
  return Response.redirect(url, 301)
}
