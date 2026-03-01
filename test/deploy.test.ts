import { test, expect } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deploy } from '@jl-org/deploy'
import type { ConnectInfo } from '@jl-org/deploy'
import { getSSHKeyOptional } from './tools'

/** 需 sshd 启用 SFTP 子系统（Subsystem sftp 或 sftp-server） */
const connectInfo: ConnectInfo = {
  host: '127.0.0.1',
  port: 22,
  username: process.env.USER || 'root',
  privateKey: getSSHKeyOptional() ?? undefined,
}

const distDir = resolve(import.meta.dir, '../dist')
const zipPath = resolve(import.meta.dir, '../dist.tar.gz')
const remoteBase = '/tmp/jl-deploy-test'
const hookExecFile = `${remoteBase}/hook-exec.txt`
const hookSpawnFile = `${remoteBase}/hook-spawn.txt`
const hookSftpFile = `${remoteBase}/hook-sftp.json`
const localPkg = resolve(import.meta.dir, '../package.json')

test('deploy 连接本地完成部署流程', async () => {
  if (!connectInfo.privateKey) throw new Error('需配置 SSH 私钥（~/.ssh/id_rsa 或 id_ed25519）')
  if (!existsSync(distDir)) throw new Error('需先执行 npm run build')
  const localPkgJson = JSON.parse(readFileSync(localPkg, 'utf-8'))
  await deploy({
    connectInfos: [connectInfo],
    distDir,
    zipPath,
    remoteZipPath: `${remoteBase}/dist.tar.gz`,
    remoteUnzipDir: `${remoteBase}/project`,
    remoteCwd: '/',
    remoteBackupDir: `${remoteBase}/backup`,
    skipBuild: true,
    interactive: false,
    onAfterDeploy: async (context) => {
      const { shell } = context
      const [execResult, spawnResult] = await Promise.all([
        shell.exec(`echo "exec-ok" > ${hookExecFile}`),
        shell.spawn(`echo "spawn-ok" > ${hookSpawnFile}`)
      ])
      expect(execResult.code).toBe(0)
      expect(spawnResult.code).toBe(0)

      await shell.sftp(async (sftp) => {
        await new Promise<void>((res, rej) => {
          sftp.fastPut(localPkg, hookSftpFile, (err) => (err ? rej(err) : res()))
        })
      })
    },
  })

  expect(existsSync(`${remoteBase}/project`)).toBe(true)
  expect(readFileSync(hookExecFile, 'utf-8').trim()).toBe('exec-ok')
  expect(readFileSync(hookSpawnFile, 'utf-8').trim()).toBe('spawn-ok')
  const remotePkgJson = JSON.parse(readFileSync(hookSftpFile, 'utf-8'))
  expect(remotePkgJson).toEqual(localPkgJson)
})
