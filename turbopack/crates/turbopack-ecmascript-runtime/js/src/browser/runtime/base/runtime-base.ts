/**
 * This file contains runtime types and functions that are shared between all
 * Turbopack *development* ECMAScript runtimes.
 *
 * It will be appended to the runtime code of each runtime right after the
 * shared runtime utils.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

/// <reference path="../base/globals.d.ts" />
/// <reference path="../../../shared/runtime-utils.ts" />

// Used in WebWorkers to tell the runtime about the chunk base path
declare var TURBOPACK_WORKER_LOCATION: string;
// Used in WebWorkers to tell the runtime about the current chunk url since it can't be detected via document.currentScript
// Note it's stored in reversed order to use push and pop
declare var TURBOPACK_NEXT_CHUNK_URLS: ChunkUrl[] | undefined;

// Injected by rust code
declare var CHUNK_BASE_PATH: string;
declare var CHUNK_SUFFIX_PATH: string;

// Provided by build or dev base
declare function instantiateModule(id: ModuleId, source: SourceInfo): Module;

type RuntimeParams = {
  otherChunks: ChunkData[];
  runtimeModuleIds: ModuleId[];
};

type ChunkRegistration = [
  chunkPath: ChunkScript,
  chunkModules: ModuleFactories,
  params: RuntimeParams | undefined
];

type ChunkList = {
  script: ChunkListScript;
  chunks: ChunkData[];
  source: "entry" | "dynamic";
};

enum SourceType {
  /**
   * The module was instantiated because it was included in an evaluated chunk's
   * runtime.
   */
  Runtime = 0,
  /**
   * The module was instantiated because a parent module imported it.
   */
  Parent = 1,
  /**
   * The module was instantiated because it was included in a chunk's hot module
   * update.
   */
  Update = 2,
}

type SourceInfo =
  | {
      type: SourceType.Runtime;
      chunkPath: ChunkPath;
    }
  | {
      type: SourceType.Parent;
      parentId: ModuleId;
    }
  | {
      type: SourceType.Update;
      parents?: ModuleId[];
    };

interface RuntimeBackend {
  registerChunk: (chunkPath: ChunkPath, params?: RuntimeParams) => void;
  loadChunk: (chunkUrl: ChunkUrl, source: SourceInfo) => Promise<void>;
}

interface DevRuntimeBackend {
  reloadChunk?: (chunkUrl: ChunkUrl) => Promise<void>;
  unloadChunk?: (chunkUrl: ChunkUrl) => void;
  restart: () => void;
}

const moduleFactories: ModuleFactories = Object.create(null);
/**
 * Module IDs that are instantiated as part of the runtime of a chunk.
 */
const runtimeModules: Set<ModuleId> = new Set();
/**
 * Map from module ID to the chunks that contain this module.
 *
 * In HMR, we need to keep track of which modules are contained in which so
 * chunks. This is so we don't eagerly dispose of a module when it is removed
 * from chunk A, but still exists in chunk B.
 */
const moduleChunksMap: Map<ModuleId, Set<ChunkPath>> = new Map();
/**
 * Map from a chunk path to all modules it contains.
 */
const chunkModulesMap: Map<ChunkPath, Set<ModuleId>> = new Map();
/**
 * Chunk lists that contain a runtime. When these chunk lists receive an update
 * that can't be reconciled with the current state of the page, we need to
 * reload the runtime entirely.
 */
const runtimeChunkLists: Set<ChunkListPath> = new Set();
/**
 * Map from a chunk list to the chunk paths it contains.
 */
const chunkListChunksMap: Map<ChunkListPath, Set<ChunkPath>> = new Map();
/**
 * Map from a chunk path to the chunk lists it belongs to.
 */
const chunkChunkListsMap: Map<ChunkPath, Set<ChunkListPath>> = new Map();

const availableModules: Map<ModuleId, Promise<any> | true> = new Map();

const availableModuleChunks: Map<ChunkPath, Promise<any> | true> = new Map();

async function loadChunk(
  source: SourceInfo,
  chunkData: ChunkData
): Promise<any> {
  if (typeof chunkData === "string") {
    return loadChunkPath(source, chunkData);
  }

  const includedList = chunkData.included || [];
  const modulesPromises = includedList.map((included) => {
    if (moduleFactories[included]) return true;
    return availableModules.get(included);
  });
  if (modulesPromises.length > 0 && modulesPromises.every((p) => p)) {
    // When all included items are already loaded or loading, we can skip loading ourselves
    return Promise.all(modulesPromises);
  }

  const includedModuleChunksList = chunkData.moduleChunks || [];
  const moduleChunksPromises = includedModuleChunksList
    .map((included) => {
      // TODO(alexkirsz) Do we need this check?
      // if (moduleFactories[included]) return true;
      return availableModuleChunks.get(included);
    })
    .filter((p) => p);

  let promise;
  if (moduleChunksPromises.length > 0) {
    // Some module chunks are already loaded or loading.

    if (moduleChunksPromises.length === includedModuleChunksList.length) {
      // When all included module chunks are already loaded or loading, we can skip loading ourselves
      return Promise.all(moduleChunksPromises);
    }

    const moduleChunksToLoad: Set<ChunkPath> = new Set();
    for (const moduleChunk of includedModuleChunksList) {
      if (!availableModuleChunks.has(moduleChunk)) {
        moduleChunksToLoad.add(moduleChunk);
      }
    }

    for (const moduleChunkToLoad of moduleChunksToLoad) {
      const promise = loadChunkPath(source, moduleChunkToLoad);

      availableModuleChunks.set(moduleChunkToLoad, promise);

      moduleChunksPromises.push(promise);
    }

    promise = Promise.all(moduleChunksPromises);
  } else {
    promise = loadChunkPath(source, chunkData.path);

    // Mark all included module chunks as loading if they are not already loaded or loading.
    for (const includedModuleChunk of includedModuleChunksList) {
      if (!availableModuleChunks.has(includedModuleChunk)) {
        availableModuleChunks.set(includedModuleChunk, promise);
      }
    }
  }

  for (const included of includedList) {
    if (!availableModules.has(included)) {
      // It might be better to race old and new promises, but it's rare that the new promise will be faster than a request started earlier.
      // In production it's even more rare, because the chunk optimization tries to deduplicate modules anyway.
      availableModules.set(included, promise);
    }
  }

  return promise;
}

async function loadChunkByUrl(source: SourceInfo, chunkUrl: ChunkUrl) {
  try {
    await BACKEND.loadChunk(chunkUrl, source);
  } catch (error) {
    let loadReason;
    switch (source.type) {
      case SourceType.Runtime:
        loadReason = `as a runtime dependency of chunk ${source.chunkPath}`;
        break;
      case SourceType.Parent:
        loadReason = `from module ${source.parentId}`;
        break;
      case SourceType.Update:
        loadReason = "from an HMR update";
        break;
      default:
        invariant(source, (source) => `Unknown source type: ${source?.type}`);
    }
    throw new Error(
      `Failed to load chunk ${chunkUrl} ${loadReason}${
        error ? `: ${error}` : ""
      }`,
      error
        ? {
            cause: error,
          }
        : undefined
    );
  }
}

async function loadChunkPath(
  source: SourceInfo,
  chunkPath: ChunkPath
): Promise<any> {
  const url = getChunkRelativeUrl(chunkPath);
  return loadChunkByUrl(source, url);
}

/**
 * Returns an absolute url to an asset.
 */
function createResolvePathFromModule(
  resolver: (moduleId: string) => Exports
): (moduleId: string) => string {
  return function resolvePathFromModule(moduleId: string): string {
    const exported = resolver(moduleId);
    return exported?.default ?? exported;
  };
}

/**
 * no-op for browser
 * @param modulePath
 */
function resolveAbsolutePath(modulePath?: string): string {
  return `/ROOT/${modulePath ?? ""}`;
}

function getWorkerBlobURL(chunks: ChunkPath[]): string {
  let bootstrap = `self.TURBOPACK_WORKER_LOCATION = ${JSON.stringify(location.origin)};
self.TURBOPACK_NEXT_CHUNK_URLS = ${JSON.stringify(chunks.reverse().map(getChunkRelativeUrl), null, 2)};
importScripts(...self.TURBOPACK_NEXT_CHUNK_URLS.map(c => self.TURBOPACK_WORKER_LOCATION + c).reverse());`;
  let blob = new Blob([bootstrap], { type: "text/javascript" });
  return URL.createObjectURL(blob);
}

/**
 * Adds a module to a chunk.
 */
function addModuleToChunk(moduleId: ModuleId, chunkPath: ChunkPath) {
  let moduleChunks = moduleChunksMap.get(moduleId);
  if (!moduleChunks) {
    moduleChunks = new Set([chunkPath]);
    moduleChunksMap.set(moduleId, moduleChunks);
  } else {
    moduleChunks.add(chunkPath);
  }

  let chunkModules = chunkModulesMap.get(chunkPath);
  if (!chunkModules) {
    chunkModules = new Set([moduleId]);
    chunkModulesMap.set(chunkPath, chunkModules);
  } else {
    chunkModules.add(moduleId);
  }
}

/**
 * Returns the first chunk that included a module.
 * This is used by the Node.js backend, hence why it's marked as unused in this
 * file.
 */
function getFirstModuleChunk(moduleId: ModuleId) {
  const moduleChunkPaths = moduleChunksMap.get(moduleId);
  if (moduleChunkPaths == null) {
    return null;
  }

  return moduleChunkPaths.values().next().value;
}

/**
 * Instantiates a runtime module.
 */
function instantiateRuntimeModule(
  moduleId: ModuleId,
  chunkPath: ChunkPath
): Module {
  return instantiateModule(moduleId, { type: SourceType.Runtime, chunkPath });
}
/**
 * Returns the URL relative to the origin where a chunk can be fetched from.
 */
function getChunkRelativeUrl(chunkPath: ChunkPath | ChunkListPath): ChunkUrl {
  return `${CHUNK_BASE_PATH}${chunkPath
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/")}${CHUNK_SUFFIX_PATH}` as ChunkUrl;
}

/**
 * Return the ChunkPath from a ChunkScript.
 */
function getPathFromScript(chunkScript: ChunkPath | ChunkScript): ChunkPath;
function getPathFromScript(chunkScript: ChunkListPath | ChunkListScript): ChunkListPath;
function getPathFromScript(chunkScript: ChunkPath | ChunkListPath | ChunkScript | ChunkListScript): ChunkPath | ChunkListPath {
  if (typeof chunkScript === "string") {
    return chunkScript as ChunkPath | ChunkListPath;
  }
  const chunkUrl = typeof TURBOPACK_NEXT_CHUNK_URLS !== "undefined"
    ? TURBOPACK_NEXT_CHUNK_URLS.pop()!
    : chunkScript.getAttribute("src")!;
  const src = decodeURIComponent(chunkUrl.replace(/[?#].*$/, ""));
  const path = src.startsWith(CHUNK_BASE_PATH) ? src.slice(CHUNK_BASE_PATH.length) : src;
  return path as ChunkPath | ChunkListPath;
}

/**
 * Marks a chunk list as a runtime chunk list. There can be more than one
 * runtime chunk list. For instance, integration tests can have multiple chunk
 * groups loaded at runtime, each with its own chunk list.
 */
function markChunkListAsRuntime(chunkListPath: ChunkListPath) {
  runtimeChunkLists.add(chunkListPath);
}

function registerChunk([
  chunkScript,
  chunkModules,
  runtimeParams,
]: ChunkRegistration) {
  const chunkPath = getPathFromScript(chunkScript);
  for (const [moduleId, moduleFactory] of Object.entries(chunkModules)) {
    if (!moduleFactories[moduleId]) {
      moduleFactories[moduleId] = moduleFactory;
    }
    addModuleToChunk(moduleId, chunkPath);
  }

  return BACKEND.registerChunk(chunkPath, runtimeParams);
}

const regexJsUrl = /\.js(?:\?[^#]*)?(?:#.*)?$/;
/**
 * Checks if a given path/URL ends with .js, optionally followed by ?query or #fragment.
 */
function isJs(chunkUrlOrPath: ChunkUrl | ChunkPath): boolean {
  return regexJsUrl.test(chunkUrlOrPath);
}

const regexCssUrl = /\.css(?:\?[^#]*)?(?:#.*)?$/;
/**
 * Checks if a given path/URL ends with .css, optionally followed by ?query or #fragment.
 */
function isCss(chunkUrl: ChunkUrl): boolean {
  return regexCssUrl.test(chunkUrl);
}
