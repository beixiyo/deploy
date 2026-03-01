import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { sshRemote, sftpRemote } from '../src/remote'
import type { ConnectInfo } from '../src/types'
import { getSSHKeyOptional } from './tools'

const testDir = resolve(import.meta.dir, 'remote-test-output')
const fixtureContent = 'jl-deploy-remote-test-' + Date.now()

const connectInfo: ConnectInfo = {
  host: '127.0.0.1',
  port: 22,
  username: process.env.USER || 'root',
  privateKey: getSSHKeyOptional() ?? undefined,
}

describe('本地 SSH 集成测试', () => {
  beforeAll(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterAll(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true })
  })

  test.skipIf(!connectInfo.privateKey)('sshRemote 连接本地并执行命令', async () => {
    const result = await sshRemote(connectInfo, async (client) => {
      return new Promise<string>((res, rej) => {
        client.exec('echo hello-local-ssh', (err, stream) => {
          if (err) return rej(err)
          let data = ''
          stream?.on('data', (chunk: Buffer | string) => { data += chunk })
          stream?.on('close', () => res(data.trim()))
        })
      })
    })

    expect(result).toBe('hello-local-ssh')
  })

  test.skipIf(!connectInfo.privateKey)('向当前测试目录推送文件', async () => {
    const localFile = resolve(testDir, 'fixture.txt')
    const remoteFile = resolve(testDir, 'uploaded.txt')
    writeFileSync(localFile, fixtureContent, 'utf-8')
    const contentB64 = Buffer.from(fixtureContent, 'utf-8').toString('base64')

    const output = await sshRemote(connectInfo, async (client) => {
      return new Promise<string>((res, rej) => {
        const cmd = `echo '${contentB64}' | base64 -d > '${remoteFile}' && cat '${remoteFile}'`
        let data = ''
        client.exec(cmd, (err, stream) => {
          if (err) return rej(err)
          stream?.on('data', (chunk: Buffer | string) => { data += chunk })
          stream?.on('close', (code: number) => (code === 0 ? res(data.trim()) : rej(new Error(`exit ${code}`))))
        })
      })
    })

    expect(output).toBe(fixtureContent)
    expect(existsSync(remoteFile)).toBe(true)
    expect(readFileSync(remoteFile, 'utf-8')).toBe(fixtureContent)
  })

  test.skipIf(!connectInfo.privateKey)('sftpRemote 通过 SFTP 上传文件', async () => {
    const localFile = resolve(testDir, 'fixture-sftp.txt')
    const remoteFile = resolve(testDir, 'uploaded-sftp.txt')
    writeFileSync(localFile, fixtureContent, 'utf-8')

    await sftpRemote(connectInfo, (sftp) => {
      return new Promise<void>((res, rej) => {
        sftp.fastPut(localFile, remoteFile, (err) => (err ? rej(err) : res()))
      })
    })

    expect(existsSync(remoteFile)).toBe(true)
    expect(readFileSync(remoteFile, 'utf-8')).toBe(fixtureContent)
  })
})
