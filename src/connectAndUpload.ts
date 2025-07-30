import { Client } from 'ssh2'
import { LogLevel, type ConnectInfo, type PartRequiredDeployOpts, type UploadHookContext } from './types'
import { ensureRemoteDirExists, retryTask, updateProgress } from './tool'
import { dirname } from 'node:path'
import { backup } from './backup'
import { logger } from './logger'
import { executeHook } from './hookAndError'
import { DeployErrorCode, DeployError } from './types'


/**
 * 将 zip 文件传输至远程服务器
 */
export async function connectAndUpload(
  opts: PartRequiredDeployOpts
): Promise<Client[]> {
  logger.info('开始连接服务器并上传文件')

  // 为每个服务器创建带重试的任务
  const uploadTasks = opts.connectInfos.map((connectInfo, index) =>
    retryTask(
      () => attemptUploadToServer({
        connectInfo,
        serverIndex: index,
        ...opts
      }),
      opts.uploadRetryCount
    )
  )

  logger.info(`准备连接 ${opts.connectInfos.length} 台服务器`)
  const results = await Promise.allSettled(uploadTasks)

  // 处理结果
  const successfulServers: Client[] = []
  let failCount = 0

  results.forEach((result, index) => {
    const serverName = opts.connectInfos[index].name || opts.connectInfos[index].host

    if (result.status === 'fulfilled') {
      successfulServers.push(result.value)
      logger.serverLog(serverName, '连接和上传成功', LogLevel.SUCCESS)
    }
    else {
      failCount++
      logger.serverLog(serverName, `连接或上传失败: ${result.reason}`, LogLevel.ERROR)
    }
  })

  // 显示总结
  if (successfulServers.length === 0) {
    throw new DeployError(
      DeployErrorCode.UPLOAD_RETRY_EXHAUSTED,
      '所有服务器连接或上传均失败，无法继续部署'
    )
  }
  else if (failCount > 0) {
    logger.warning(`共 ${opts.connectInfos.length} 台服务器，${successfulServers.length} 台连接和上传成功，${failCount} 台失败`)
  }
  else {
    logger.success(`所有 ${opts.connectInfos.length} 台服务器连接和上传成功`)
  }

  // 返回所有成功连接并上传的 sshServer 实例
  return successfulServers
}

/**
 * 尝试连接并上传单个服务器
 */
function attemptUploadToServer(
  options: AttemptUploadToServerOpts
): Promise<Client> {
  const {
    connectInfo,
    serverIndex,
    zipPath,
    remoteZipPath,
    remoteBackupDir,
    maxBackupCount,
    onServerReady,
    ...opts
  } = options

  return new Promise<Client>((resolve, reject) => {
    const sshServer = new Client()
    const serverName = connectInfo.name || connectInfo.host

    const dispose = (err: any) => {
      sshServer.end()
      sshServer.destroy()
      return reject(err)
    }

    sshServer
      .on('ready', async () => {
        try {
          if (onServerReady) {
            logger.serverLog(serverName, '服务器连接成功，执行就绪回调')
            await onServerReady(sshServer, connectInfo)
          }

          // 执行上传前的 hook
          const uploadContext: UploadHookContext = {
            opts: options,
            stage: 'upload',
            startTime: Date.now(),
            connectInfo,
            serverIndex,
            zipPath,
            remoteZipPath
          }

          await executeHook(opts.onBeforeUpload, uploadContext)

          logger.serverLog(serverName, '开始上传文件')

          sshServer.sftp(async (err, sftp) => {
            if (err) {
              logger.serverLog(serverName, 'SFTP 初始化失败', LogLevel.ERROR)
              return dispose(new DeployError(
                DeployErrorCode.CONNECT_SFTP_FAILED,
                'SFTP 初始化失败',
                err,
                serverName
              ))
            }

            try {
              await ensureRemoteDirExists(sshServer, sftp, dirname(remoteZipPath))

              sftp.fastPut(
                zipPath, remoteZipPath,
                {
                  step: (current, _nb, total) => {
                    updateProgress(current, total, (percent, progressText) => {
                      logger.progress({
                        message: '上传进度:',
                        current,
                        total,
                        prefix: serverName,
                        displayType: 'percentage',
                        customText: progressText,
                        sameLine: true
                      })
                    })
                  }
                },
                async (err) => {
                  if (err) {
                    logger.serverLog(serverName, '文件上传失败', LogLevel.ERROR)
                    return dispose(new DeployError(
                      DeployErrorCode.UPLOAD_FILE_FAILED,
                      '文件上传失败',
                      err,
                      serverName
                    ))
                  }

                  if (remoteBackupDir) {
                    logger.serverLog(serverName, '开始备份文件')
                    await backup({
                      sftp,
                      connectInfo,
                      zipPath,
                      remoteBackupDir,
                      maxBackupCount,
                      sshServer
                    })
                  }

                  logger.serverLog(serverName, '文件上传成功', LogLevel.SUCCESS)
                  logger.newLine()

                  // 执行上传后的 hook
                  uploadContext.sshClient = sshServer
                  await executeHook(opts.onAfterUpload, uploadContext)

                  resolve(sshServer)
                })
            }
            catch (error) {
              logger.serverLog(serverName, '上传过程中出错', LogLevel.ERROR)
              return dispose(new DeployError(
                DeployErrorCode.UPLOAD_REMOTE_DIR_FAILED,
                '上传过程中出错',
                error,
                serverName
              ))
            }
          })
        }
        catch (readyError) { // 捕获 onServerReady 中的同步/异步错误
          logger.serverLog(serverName, 'onServerReady 回调执行失败', LogLevel.ERROR)
          return dispose(new DeployError(
            DeployErrorCode.CONNECT_SSH_FAILED,
            'onServerReady 回调执行失败',
            readyError,
            serverName
          ))
        }
      })
      .on('error', err => {
        logger.serverLog(serverName, `连接失败: ${err.message}`, LogLevel.ERROR)
        // 连接错误时，sshServer 可能未完全建立，尝试 end/destroy 可能再次触发错误，但仍需尝试清理
        try {
          sshServer.end()
          sshServer.destroy()
        }
        catch (destroyErr) {
          // 忽略销毁错误
        }
        reject(new DeployError(
          DeployErrorCode.CONNECT_SSH_FAILED,
          `连接失败: ${err.message}`,
          err,
          serverName
        ))
      })
      .connect(connectInfo)
  })
}



type AttemptUploadToServerOpts = {
  connectInfo: ConnectInfo
  serverIndex: number
  zipPath: string
  remoteZipPath: string
  remoteBackupDir?: string
  maxBackupCount?: number
  onServerReady?: (server: Client, connectInfo: ConnectInfo) => Promise<void>
} & PartRequiredDeployOpts
