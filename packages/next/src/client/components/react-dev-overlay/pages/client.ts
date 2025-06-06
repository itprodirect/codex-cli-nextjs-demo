import * as Bus from './bus'
import { parseStack } from '../utils/parse-stack'
import { parseComponentStack } from '../utils/parse-component-stack'
import {
  attachHydrationErrorState,
  storeHydrationErrorStateFromConsoleArgs,
} from './hydration-error-state'
import {
  ACTION_BEFORE_REFRESH,
  ACTION_BUILD_ERROR,
  ACTION_BUILD_OK,
  ACTION_DEV_INDICATOR,
  ACTION_REFRESH,
  ACTION_STATIC_INDICATOR,
  ACTION_UNHANDLED_ERROR,
  ACTION_UNHANDLED_REJECTION,
  ACTION_VERSION_INFO,
} from '../shared'
import type { VersionInfo } from '../../../../server/dev/parse-version-info'
import { getComponentStack, getOwnerStack } from '../../errors/stitched-error'
import type { DevIndicatorServerState } from '../../../../server/dev/dev-indicator-server-state'

let isRegistered = false

function handleError(error: unknown) {
  if (!error || !(error instanceof Error) || typeof error.stack !== 'string') {
    // A non-error was thrown, we don't have anything to show. :-(
    return
  }

  attachHydrationErrorState(error)

  const componentStackTrace = getComponentStack(error)
  const ownerStack = getOwnerStack(error)
  const componentStackFrames =
    typeof componentStackTrace === 'string'
      ? parseComponentStack(componentStackTrace)
      : undefined

  // Skip ModuleBuildError and ModuleNotFoundError, as it will be sent through onBuildError callback.
  // This is to avoid same error as different type showing up on client to cause flashing.
  if (
    error.name !== 'ModuleBuildError' &&
    error.name !== 'ModuleNotFoundError'
  ) {
    Bus.emit({
      type: ACTION_UNHANDLED_ERROR,
      reason: error,
      frames: parseStack((error.stack || '') + (ownerStack || '')),
      componentStackFrames,
    })
  }
}

let origConsoleError = console.error
function nextJsHandleConsoleError(...args: any[]) {
  // See https://github.com/facebook/react/blob/d50323eb845c5fde0d720cae888bf35dedd05506/packages/react-reconciler/src/ReactFiberErrorLogger.js#L78
  const maybeError = process.env.NODE_ENV !== 'production' ? args[1] : args[0]
  storeHydrationErrorStateFromConsoleArgs(...args)
  // TODO: Surfaces non-errors logged via `console.error`.
  handleError(maybeError)
  origConsoleError.apply(window.console, args)
}

function onUnhandledError(event: ErrorEvent) {
  const error = event?.error
  handleError(error)
}

function onUnhandledRejection(ev: PromiseRejectionEvent) {
  const reason = ev?.reason
  if (
    !reason ||
    !(reason instanceof Error) ||
    typeof reason.stack !== 'string'
  ) {
    // A non-error was thrown, we don't have anything to show. :-(
    return
  }

  const error = reason
  const ownerStack = getOwnerStack(error)
  Bus.emit({
    type: ACTION_UNHANDLED_REJECTION,
    reason: reason,
    frames: parseStack((error.stack || '') + (ownerStack || '')),
  })
}

export function register() {
  if (isRegistered) {
    return
  }
  isRegistered = true

  try {
    Error.stackTraceLimit = 50
  } catch {}

  window.addEventListener('error', onUnhandledError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)
  window.console.error = nextJsHandleConsoleError
}

export function onBuildOk() {
  Bus.emit({ type: ACTION_BUILD_OK })
}

export function onBuildError(message: string) {
  Bus.emit({ type: ACTION_BUILD_ERROR, message })
}

export function onRefresh() {
  Bus.emit({ type: ACTION_REFRESH })
}

export function onBeforeRefresh() {
  Bus.emit({ type: ACTION_BEFORE_REFRESH })
}

export function onVersionInfo(versionInfo: VersionInfo) {
  Bus.emit({ type: ACTION_VERSION_INFO, versionInfo })
}

export function onStaticIndicator(isStatic: boolean) {
  Bus.emit({ type: ACTION_STATIC_INDICATOR, staticIndicator: isStatic })
}

export function onDevIndicator(devIndicatorsState: DevIndicatorServerState) {
  Bus.emit({ type: ACTION_DEV_INDICATOR, devIndicator: devIndicatorsState })
}

export { getErrorByType } from '../utils/get-error-by-type'
export { getServerError } from '../utils/node-stack-frames'
