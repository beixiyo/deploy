import { Client, type SFTPWrapper } from 'ssh2'
import type { DeployOpts, ConnectInfo } from './types'
import { getLocalToday, retryTask, toUnixPath } from './tool'
import { join } from 'node:path'


/**
 * 将 zip 文件传输至远程服务器
 */
export async function connectAndUpload(
  opts: DeployOpts
): Promise<Client[]> {
  // 为每个服务器创建带重试的任务
  const uploadTasks = opts.connectInfos.map((connectInfo) =>
    retryTask(
      () => attemptUploadToServer({
        connectInfo,
        ...opts
      }),
      opts.uploadRetryCount
    )
  )

  // 等待所有上传任务完成（包括重试）
  // Promise.all 会在任何一个任务最终失败时立即 reject
  const successfulServers = await Promise.all(uploadTasks)

  // 返回所有成功连接并上传的 sshServer 实例
  return successfulServers
}

/**
 * 尝试连接并上传单个服务器
 */
function attemptUploadToServer(
  {
    connectInfo,
    zipPath,
    remoteZipPath,
    remoteBackupPath,
    onServerReady,
  }: AttemptUploadToServerOpts
): Promise<Client> {
  return new Promise<Client>((resolve, reject) => {
    const sshServer = new Client()

    sshServer
      .on('ready', async () => {
        try {
          if (onServerReady) {
            await onServerReady(sshServer, connectInfo)
          }
          console.log(`--连接服务器 ${connectInfo.name ?? ''}: ${connectInfo.host} 成功--`)

          sshServer.sftp((err, sftp) => {
            if (err) {
              console.error(`---${connectInfo.name ?? ''}: 压缩包上传失败 (SFTP 错误)---`)
              // SFTP 失败时也需要销毁连接，避免资源泄露
              sshServer.end()
              sshServer.destroy()
              return reject(err)
            }

            sftp.fastPut(zipPath, remoteZipPath, {}, async (err) => {
              if (err) {
                console.error(`---${connectInfo.name ?? ''}: 压缩包上传失败 (fastPut 错误)---`)
                // 上传失败时也需要销毁连接
                sshServer.end()
                sshServer.destroy()
                return reject(err)
              }

              if (remoteBackupPath) {
                await backup({
                  sftp,
                  connectInfo,
                  zipPath,
                  remoteBackupPath
                })
              }

              console.log(`---${connectInfo.name ?? ''}: 压缩包上传成功---`)
              resolve(sshServer)
            })
          })
        }
        catch (readyError) { // 捕获 onServerReady 中的同步/异步错误
          console.error(`---${connectInfo.name ?? ''}: onServerReady 回调执行失败---`, readyError)
          sshServer.end()
          sshServer.destroy()
          reject(readyError)
        }
      })
      .on('error', err => {
        console.error(`---${connectInfo.name ?? ''}: 连接服务器失败---`, err.message)
        // 连接错误时，sshServer 可能未完全建立，尝试 end/destroy 可能再次触发错误，但仍需尝试清理
        try {
          sshServer.end()
          sshServer.destroy()
        }
        catch (destroyErr) {
          // 忽略销毁错误
        }
        reject(err.message)
      })
      .connect(connectInfo)
  })
}

async function backup(
  {
    sftp,
    connectInfo,
    remoteBackupPath,
    zipPath,
  }: BackupOpts
) {
  const backupFileName = `${getLocalToday()}.tar.gz`
  const remoteBackupFileFullName = toUnixPath(join(remoteBackupPath, backupFileName))

  return new Promise<void>((resolve, reject) => {
    try {
      // 检查备份文件是否存在
      sftp.stat(remoteBackupFileFullName, (statErr) => {
        // 文件不存在或发生其他错误，尝试上传
        if (statErr) {
          console.log(`---${connectInfo.name ?? ''}: 准备上传备份文件到 ${remoteBackupFileFullName}---`)

          sftp.fastPut(zipPath, remoteBackupFileFullName, {}, (backupUploadErr) => {
            if (backupUploadErr) {
              console.error(`---${connectInfo.name ?? ''}: 备份压缩包上传失败 (${remoteBackupFileFullName})---`, backupUploadErr)
              reject(backupUploadErr)
            }
            else {
              console.log(`---${connectInfo.name ?? ''}: 备份压缩包上传成功 (${remoteBackupFileFullName})---`)
              resolve()
            }
          })
        }
        else {
          console.warn(`---${connectInfo.name ?? ''}: 备份文件 ${remoteBackupFileFullName} 已存在，跳过备份---`)
          resolve()
        }
      })
    }
    catch (error) {
      reject(error)
      console.error(`---${connectInfo.name ?? ''}: 备份文件 ${remoteBackupFileFullName} 上传失败 (${remoteBackupFileFullName})---`, error)
    }
  })
}

type AttemptUploadToServerOpts = {
  connectInfo: ConnectInfo
  zipPath: string
  remoteZipPath: string
  remoteBackupPath?: string
  onServerReady?: (server: Client, connectInfo: ConnectInfo) => Promise<void>
}

type BackupOpts = {
  sftp: SFTPWrapper
  connectInfo: ConnectInfo
  remoteBackupPath: string
  zipPath: string
}