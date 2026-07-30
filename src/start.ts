import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'

import { getCanonicalRedirect } from './lib/canonical-domain'

const canonicalDomainMiddleware = createMiddleware().server(
  ({ request, next }) => {
    const redirectResponse = getCanonicalRedirect(request.url)

    if (redirectResponse) {
      return redirectResponse
    }

    return next()
  },
)

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [canonicalDomainMiddleware, csrfMiddleware],
}))
