import { test, expect } from 'bun:test'
import { deploy } from '@jl-org/deploy'

test('ESM 模块可正确加载并导出 deploy 函数', () => {
  expect(typeof deploy).toBe('function')
})
