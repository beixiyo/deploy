import { Client, type SFTPWrapper } from 'ssh2'
import { logger } from './logger'
import { DeployErrorCode, DeployError, LogLevel } from './types'
import type { ConnectInfo } from './types'

type CreateSshClient = () => Client

function createSshClientFactory(createClient?: CreateSshClient): CreateSshClient {
  return createClient ?? (() => new Client())
}

/**
 * 建立 SSH 连接并执行任务，任务完成后自动断开。
 * 不依赖完整部署流程，适合自定义脚本或仅需远程执行命令的场景。
 *
 * @param connectInfo - SSH 连接信息（host 必填，port/username/password/privateKey 等同 ssh2 ConnectConfig）
 * @param task - 接收 ssh2 Client，返回 Promise；可在其中执行 exec、shell、sftp 等
 * @returns task 的返回值
 *
 * @example
 * ```ts
 * import { sshRemote, type ConnectInfo } from '@your/deploy'
 *
 * await sshRemote(connectInfo, async (client) => {
 *   return new Promise((resolve, reject) => {
 *     client.exec('ls -la', (err, stream) => {
 *       if (err) return reject(err)
 *       stream.on('data', (d) => process.stdout.write(d))
 *       stream.stderr.on('data', (d) => process.stderr.write(d))
 *       stream.on('close', (code) => resolve(code))
 *     })
 *   })
 * })
 * ```
 */
export function sshRemote<T>(
  connectInfo: ConnectInfo,
  task: (client: Client) => Promise<T>,
  createClient?: CreateSshClient
): Promise<T> {
  const serverName = connectInfo.name ?? connectInfo.host
  const getClient = createSshClientFactory(createClient)

  return new Promise<T>((resolve, reject) => {
    const sshServer = getClient()

    sshServer
      .on('ready', async () => {
        try {
          const result = await task(sshServer)
          sshServer.end()
          sshServer.destroy()
          resolve(result)
        }
        catch (err) {
          sshServer.end()
          sshServer.destroy()
          reject(err)
        }
      })
      .on('error', (err) => {
        logger.serverLog(serverName, `远程 SSH 连接失败: ${err.message}`, LogLevel.ERROR)
        reject(new DeployError(
          DeployErrorCode.CONNECT_SSH_FAILED,
          `远程 SSH 连接失败: ${err.message}`,
          err,
          serverName
        ))
      })
      .connect(connectInfo)
  })
}

/**
 * 建立 SSH 连接并获取 SFTP 通道执行任务，任务完成后自动断开。
 * 不依赖完整部署流程，适合自定义上传/下载或仅需 SFTP 操作的场景。
 *
 * @param connectInfo - SSH 连接信息
 * @param task - 接收 ssh2 SFTPWrapper，可调用 fastPut、fastGet、readdir、mkdir、stat 等
 * @returns task 的返回值
 *
 * @example
 * ```ts
 * import { sftpRemote, type ConnectInfo } from '@your/deploy'
 *
 * await sftpRemote(connectInfo, async (sftp) => {
 *   return new Promise((resolve, reject) => {
 *     sftp.fastPut('/local/path/file.txt', '/remote/path/file.txt', (err) => {
 *       if (err) reject(err)
 *       else resolve(undefined)
 *     })
 *   })
 * })
 * ```
 */
export function sftpRemote<T>(
  connectInfo: ConnectInfo,
  task: (sftp: SFTPWrapper) => Promise<T>,
  createClient?: CreateSshClient
): Promise<T> {
  const serverName = connectInfo.name ?? connectInfo.host

  logger.serverLog(serverName, '建立 SFTP 连接', LogLevel.INFO)

  return sshRemote(connectInfo, (sshServer) => {
    return new Promise<T>((resolve, reject) => {
      sshServer.sftp((err, sftp) => {
        if (err) {
          logger.serverLog(serverName, `SFTP 初始化失败: ${err.message}`, LogLevel.ERROR)
          return reject(new DeployError(
            DeployErrorCode.CONNECT_SFTP_FAILED,
            `SFTP 初始化失败: ${err.message}`,
            err,
            serverName
          ))
        }
        task(sftp!)
          .then(resolve)
          .catch(reject)
      })
    })
  }, createClient)
}
