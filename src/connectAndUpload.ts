import { Client } from 'ssh2'
import type { DeployOpts, ConnectInfo } from './types' // 引入 ConnectInfo
import { retryTask } from './tool'


/**
 * 尝试连接并上传单个服务器
 */
function attemptUploadToServer(
  connectInfo: ConnectInfo,
  zipPath: string,
  remoteZipPath: string,
  onServerReady?: (server: Client, connectInfo: ConnectInfo) => Promise<void>
): Promise<Client> { // 返回 Client 以便后续使用
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

            sftp.fastPut(zipPath, remoteZipPath, {}, (err) => {
              if (err) {
                console.error(`---${connectInfo.name ?? ''}: 压缩包上传失败 (fastPut 错误)---`)
                // 上传失败时也需要销毁连接
                sshServer.end()
                sshServer.destroy()
                return reject(err)
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


/**
 * 将 zip 文件传输至远程服务器
 */
export async function connectAndUpload(
  {
    zipPath,
    remoteZipPath,
    connectInfos,
    uploadRetryCount,
    onServerReady
  }: Pick<DeployOpts, 'zipPath' | 'remoteZipPath' | 'connectInfos' | 'onServerReady' | 'uploadRetryCount'>
): Promise<Client[]> {
  // 为每个服务器创建带重试的任务
  const uploadTasks = connectInfos.map((connectInfo) =>
    retryTask(
      () => attemptUploadToServer(connectInfo, zipPath, remoteZipPath, onServerReady),
      uploadRetryCount
    )
  )

  // 等待所有上传任务完成（包括重试）
  // Promise.all 会在任何一个任务最终失败时立即 reject
  const successfulServers = await Promise.all(uploadTasks)

  // 返回所有成功连接并上传的 sshServer 实例
  return successfulServers
}
