import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'

const ONE_DAY_SECONDS = 24 * 60 * 60

export const DiffsBucket = Cloudflare.R2.Bucket(
  'Diffs',
  Alchemy.Stack.useSync((stack) => ({
    name: stack.stage === 'prod' ? 'diffdump-diffs' : undefined,
    lifecycleRules: [
      {
        id: 'expire-diffs-after-one-day',
        prefix: 'diffs/',
        deleteObjectsTransition: {
          condition: {
            type: 'Age' as const,
            maxAge: ONE_DAY_SECONDS,
          },
        },
      },
    ],
  })),
)

export const Website = Cloudflare.Website.Vite(
  'Website',
  Alchemy.Stack.useSync((stack) => ({
    name: stack.stage === 'prod' ? 'diffdump' : undefined,
    domain: stack.stage === 'prod' ? 'diffdump.com' : undefined,
    url: stack.stage !== 'prod',
    compatibility: {
      date: '2025-09-02',
      flags: ['nodejs_compat' as const],
    },
    assets: {
      runWorkerFirst: true,
    },
    dev: {
      port: 3000,
    },
    env: {
      DIFFS: DiffsBucket,
    },
  })),
)

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>

export default Alchemy.Stack(
  'diffdump',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const bucket = yield* DiffsBucket
    const website = yield* Website

    return {
      bucketName: bucket.bucketName,
      url: website.url,
    }
  }),
)
