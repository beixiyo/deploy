import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { compress } from '../src/startZip'

const testDir = resolve(import.meta.dir, 'compress-test-output')
const distDir = resolve(testDir, 'dist')
const zipPath = resolve(testDir, 'out.tar.gz')
const fixtureContent = 'jl-deploy-compress-test-' + Date.now()

describe('compress 集成测试', () => {
  beforeAll(() => {
    mkdirSync(distDir, { recursive: true })
    writeFileSync(resolve(distDir, 'index.html'), '<html>hello</html>', 'utf-8')
    writeFileSync(resolve(distDir, 'data.json'), JSON.stringify({ fixture: fixtureContent }), 'utf-8')
    mkdirSync(resolve(distDir, 'assets'), { recursive: true })
    writeFileSync(resolve(distDir, 'assets', 'style.css'), 'body { margin: 0; }', 'utf-8')
  })

  afterAll(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true })
  })

  test('compress 产出文件存在且大小大于 0', async () => {
    const result = await compress({
      distDir,
      zipPath,
    })

    expect(existsSync(zipPath)).toBe(true)
    expect(statSync(zipPath).size).toBeGreaterThan(0)
    expect(result.bytesWritten).toBe(statSync(zipPath).size)
  })

  test('compress 支持 onProgress 回调', async () => {
    const progressCalls: [number, number][] = []
    const outPath = resolve(testDir, 'out-with-progress.tar.gz')

    await compress({
      distDir,
      zipPath: outPath,
      onProgress(processedBytes, totalBytes) {
        progressCalls.push([processedBytes, totalBytes])
      },
    })

    expect(existsSync(outPath)).toBe(true)
    expect(progressCalls.length).toBeGreaterThan(0)
    const [lastProcessed, lastTotal] = progressCalls[progressCalls.length - 1]
    expect(lastProcessed).toBe(lastTotal)
  })

  test('distDir 不存在时抛出 DeployError', async () => {
    const { DeployErrorCode } = await import('../src/types')
    const badDir = resolve(testDir, 'nonexistent')
    let err: unknown
    try {
      await compress({ distDir: badDir, zipPath: resolve(testDir, 'x.tar.gz') })
    }
    catch (e) {
      err = e
    }
    expect(err).toBeDefined()
    expect(err).toMatchObject({
      code: DeployErrorCode.COMPRESS_SOURCE_NOT_FOUND,
      message: expect.stringContaining('不存在'),
    })
  })
})
