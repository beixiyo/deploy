const { test, expect } = require('bun:test')
const { deploy } = require('@jl-org/deploy')

test('CJS 模块可正确加载并导出 deploy 函数', () => {
  expect(typeof deploy).toBe('function')
})
