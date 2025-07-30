import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  bundle: true,
  minify: true,
  /**
   * polyfill 一些 Node 特有的功能（如 __dirname、require）
   * 对于 ESM 格式，这些 Node 内置变量是没有的，设置 shims: true 会用兼容代码模拟这些行为
  */
  shims: true,
  target: 'node18',
  platform: 'node',
  esbuildOptions: (options) => {
    /**
     * 表示 node_modules 中的包不打包进产物，而是保留 require() 或 import
     */
    options.packages = 'external'
  }
})
