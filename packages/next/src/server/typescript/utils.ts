import type { VirtualTypeScriptEnvironment } from 'next/dist/compiled/@typescript/vfs'
import {
  createFSBackedSystem,
  createDefaultMapFromNodeModules,
  createVirtualTypeScriptEnvironment,
} from 'next/dist/compiled/@typescript/vfs'

import path, { join } from 'path'

import type tsModule from 'typescript/lib/tsserverlibrary'
type TypeScript = typeof import('typescript/lib/tsserverlibrary')

let ts: TypeScript
let info: tsModule.server.PluginCreateInfo
let appDirRegExp: RegExp
export let virtualTsEnv: VirtualTypeScriptEnvironment

export function log(message: string) {
  info.project.projectService.logger.info('[next] ' + message)
}

// This function has to be called initially.
export function init(opts: {
  ts: TypeScript
  info: tsModule.server.PluginCreateInfo
}): boolean {
  const projectDir = opts.info.project.getCurrentDirectory()
  ts = opts.ts
  info = opts.info
  appDirRegExp = new RegExp(
    '^' + (projectDir + '(/src)?/app').replace(/[\\/]/g, '[\\/]')
  )

  log('Initializing Next.js TypeScript plugin: ' + projectDir)

  const compilerOptions = info.project.getCompilerOptions()
  const fsMap = createDefaultMapFromNodeModules(
    compilerOptions,
    ts,
    join(projectDir, 'node_modules/typescript/lib')
  )
  const system = createFSBackedSystem(fsMap, projectDir, ts)

  virtualTsEnv = createVirtualTypeScriptEnvironment(
    system,
    [],
    ts,
    compilerOptions
  )

  if (!virtualTsEnv) {
    log(
      'Failed to create virtual TypeScript environment. This is a bug in Next.js TypeScript plugin. Please report it by opening an issue at https://github.com/vercel/next.js/issues.'
    )
    return false
  }

  log('Successfully initialized Next.js TypeScript plugin!')
  return true
}

export function getTs() {
  return ts
}

export function getInfo() {
  return info
}

export function getTypeChecker() {
  return info.languageService.getProgram()?.getTypeChecker()
}

export function getSource(fileName: string) {
  return info.languageService.getProgram()?.getSourceFile(fileName)
}

export function getSourceFromVirtualTsEnv(fileName: string) {
  if (virtualTsEnv.sys.fileExists(fileName)) {
    return virtualTsEnv.getSourceFile(fileName)
  }
  return getSource(fileName)
}

export function removeStringQuotes(str: string): string {
  return str.replace(/^['"`]|['"`]$/g, '')
}

export const isPositionInsideNode = (position: number, node: tsModule.Node) => {
  const start = node.getFullStart()
  return start <= position && position <= node.getFullWidth() + start
}

export const isDefaultFunctionExport = (
  node: tsModule.Node
): node is tsModule.FunctionDeclaration => {
  if (ts.isFunctionDeclaration(node)) {
    let hasExportKeyword = false
    let hasDefaultKeyword = false

    if (node.modifiers) {
      for (const modifier of node.modifiers) {
        if (modifier.kind === ts.SyntaxKind.ExportKeyword) {
          hasExportKeyword = true
        } else if (modifier.kind === ts.SyntaxKind.DefaultKeyword) {
          hasDefaultKeyword = true
        }
      }
    }

    // `export default function`
    if (hasExportKeyword && hasDefaultKeyword) {
      return true
    }
  }
  return false
}

export const isInsideApp = (filePath: string) => {
  return appDirRegExp.test(filePath)
}
export const isAppEntryFile = (filePath: string) => {
  return (
    appDirRegExp.test(filePath) &&
    /^(page|layout)\.(mjs|js|jsx|ts|tsx)$/.test(path.basename(filePath))
  )
}
export const isPageFile = (filePath: string) => {
  return (
    appDirRegExp.test(filePath) &&
    /^page\.(mjs|js|jsx|ts|tsx)$/.test(path.basename(filePath))
  )
}

// Check if a module is a client entry.
export function getEntryInfo(
  fileName: string,
  throwOnInvalidDirective?: boolean
) {
  const source = getSource(fileName)
  if (source) {
    let isDirective = true
    let isClientEntry = false
    let isServerEntry = false

    ts.forEachChild(source!, (node) => {
      if (
        ts.isExpressionStatement(node) &&
        ts.isStringLiteral(node.expression)
      ) {
        if (node.expression.text === 'use client') {
          if (isDirective) {
            isClientEntry = true
          } else {
            if (throwOnInvalidDirective) {
              const e = {
                messageText:
                  'The `"use client"` directive must be put at the top of the file.',
                start: node.expression.getStart(),
                length: node.expression.getWidth(),
              }
              throw e
            }
          }
        } else if (node.expression.text === 'use server') {
          if (isDirective) {
            isServerEntry = true
          } else {
            if (throwOnInvalidDirective) {
              const e = {
                messageText:
                  'The `"use server"` directive must be put at the top of the file.',
                start: node.expression.getStart(),
                length: node.expression.getWidth(),
              }
              throw e
            }
          }
        }

        if (isClientEntry && isServerEntry) {
          const e = {
            messageText:
              'Cannot use both "use client" and "use server" directives in the same file.',
            start: node.expression.getStart(),
            length: node.expression.getWidth(),
          }
          throw e
        }
      } else {
        isDirective = false
      }
    })

    return { client: isClientEntry, server: isServerEntry }
  }

  return { client: false, server: false }
}
