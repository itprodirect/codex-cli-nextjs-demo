import type { AsyncLocalStorage } from 'async_hooks'
import type { IncrementalCache } from '../lib/incremental-cache'
import type { FetchMetrics } from '../base-http'
import type { FallbackRouteParams } from '../request/fallback-params'
import type { DeepReadonly } from '../../shared/lib/deep-readonly'
import type { AppSegmentConfig } from '../../build/segment-config/app/app-segment-config'
import type { AfterContext } from '../after/after-context'
import type { CacheLife } from '../use-cache/cache-life'

// Share the instance module in the next-shared layer
import { workAsyncStorageInstance } from './work-async-storage-instance' with { 'turbopack-transition': 'next-shared' }
import type { LazyResult } from '../lib/lazy-result'

export interface WorkStore {
  readonly isStaticGeneration: boolean

  /**
   * The page that is being rendered. This relates to the path to the page file.
   */
  readonly page: string

  /**
   * The route that is being rendered. This is the page property without the
   * trailing `/page` or `/route` suffix.
   */
  readonly route: string

  /**
   * The set of unknown route parameters. Accessing these will be tracked as
   * a dynamic access.
   */
  readonly fallbackRouteParams: FallbackRouteParams | null

  readonly incrementalCache?: IncrementalCache
  readonly cacheLifeProfiles?: { [profile: string]: CacheLife }

  readonly isOnDemandRevalidate?: boolean
  readonly isPrerendering?: boolean
  readonly isRevalidate?: boolean

  forceDynamic?: boolean
  fetchCache?: AppSegmentConfig['fetchCache']

  forceStatic?: boolean
  dynamicShouldError?: boolean
  pendingRevalidates?: Record<string, Promise<any>>
  pendingRevalidateWrites?: Array<Promise<void>> // This is like pendingRevalidates but isn't used for deduping.
  readonly afterContext: AfterContext

  dynamicUsageDescription?: string
  dynamicUsageStack?: string

  /**
   * Invalid usage errors might be caught in userland. We attach them to the
   * work store to ensure we can still fail the build or dev render.
   */
  // TODO: Collect an array of errors, and throw as AggregateError when
  // `serializeError` and the Dev Overlay support it.
  invalidUsageError?: Error

  nextFetchId?: number
  pathWasRevalidated?: boolean

  /**
   * Tags that were revalidated during the current request. They need to be sent
   * to cache handlers to propagate their revalidation.
   */
  pendingRevalidatedTags?: string[]

  /**
   * Tags that were previously revalidated (e.g. by a redirecting server action)
   * and have already been sent to cache handlers. Retrieved cache entries that
   * include any of these tags must be discarded.
   */
  readonly previouslyRevalidatedTags: readonly string[]

  /**
   * This map contains lazy results so that we can evaluate them when the first
   * cache entry is read. It allows us to skip refreshing tags if no caches are
   * read at all.
   */
  readonly refreshTagsByCacheKind: Map<string, LazyResult<void>>

  fetchMetrics?: FetchMetrics

  isDraftMode?: boolean
  isUnstableNoStore?: boolean
  isPrefetchRequest?: boolean

  requestEndedState?: { ended?: boolean }

  buildId: string

  readonly reactLoadableManifest?: DeepReadonly<
    Record<string, { files: string[] }>
  >
  readonly assetPrefix?: string

  dynamicIOEnabled: boolean
  dev: boolean
}

export type WorkAsyncStorage = AsyncLocalStorage<WorkStore>

export { workAsyncStorageInstance as workAsyncStorage }
