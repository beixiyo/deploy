import { test, expect } from 'bun:test'
import { deploy, DeployErrorCode,type DeployOpts } from '@jl-org/deploy'
import { resolve } from 'node:path'

test('remoteUnzipDir 与 remoteZipPath 目录相同时应报错', async () => {
  const opts: DeployOpts = {
    connectInfos: [{ host: '127.0.0.1', port: 22, username: 'root', privateKey: 'dummy' }],
    distDir: resolve(import.meta.dir, '../dist'),
    zipPath: resolve(import.meta.dir, '../dist.tar.gz'),
    remoteZipPath: '/home/test-deploy/dist.tar.gz',
    remoteUnzipDir: '/home/test-deploy', // 与 dirname(remoteZipPath) 相同
    skipBuild: true,
    interactive: false,
  }

  expect(deploy(opts)).rejects.toMatchObject({
    code: DeployErrorCode.CONFIG_VALIDATION_FAILED,
    message: 'remoteUnzipDir 不能与 remoteZipPath 的目录相同，因为部署过程会先删除 remoteUnzipDir',
  })
})
