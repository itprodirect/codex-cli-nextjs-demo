/* eslint-env jest */

import fs from 'fs/promises'
import { join } from 'path'
import {
  killApp,
  launchApp,
  findPort,
  File,
  renderViaHTTP,
} from 'next-test-utils'

const appDir = join(__dirname, '../')

describe('default', () => {
  it('should use externals for unvendored node_modules reachable from the project', async () => {
    const port = await findPort()
    const config = new File(join(appDir, 'next.config.js'))
    config.delete()
    try {
      const app = await launchApp(appDir, port)
      await renderViaHTTP(port, '/')
      if (process.env.IS_TURBOPACK_TEST) {
        const ssrPath = join(appDir, '.next/server/chunks/ssr')
        const pageBundleBasenames = (await fs.readdir(ssrPath)).filter((p) =>
          p.match(/\.js$/)
        )
        expect(pageBundleBasenames).not.toBeEmpty()
        let allBundles = ''
        for (const basename of pageBundleBasenames) {
          const output = await fs.readFile(join(ssrPath, basename), 'utf8')
          allBundles += output
        }

        // we don't know the name of the minified `__turbopack_external_require__`, so we just check the content.
        expect(allBundles).toContain('"external-package"')
        expect(allBundles).not.toContain('"external-package content"')
      } else {
        const output = await fs.readFile(
          join(appDir, '.next/server/pages/index.js'),
          'utf8'
        )
        expect(output).toContain('require("external-package")')
      }
      await killApp(app)
    } finally {
      config.restore()
    }
  })
})
