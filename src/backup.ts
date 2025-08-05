import { Client, type SFTPWrapper } from 'ssh2'
import { LogLevel, type ConnectInfo } from './types'
import { ensureRemoteDirExists, getLocalToday, toUnixPath, updateProgress } from './tool'
import { join } from 'node:path'
import { logger } from './logger'
import { DeployErrorCode, DeployError } from './types'


export async function backup(
  {
    sftp,
    connectInfo,
    remoteBackupDir,
    remoteZipPath,
    localZipPath,
    maxBackupCount,
    sshServer
  }: BackupOpts
) {
  const backupFileName = `${getLocalToday()}.tar.gz`
  const serverName = connectInfo.name || connectInfo.host
  const remoteBackupFileFullName = toUnixPath(join(remoteBackupDir, backupFileName))

  try {
    // 确保远程备份目录存在
    await ensureRemoteDirExists(sshServer, sftp, remoteBackupDir)
    await proceedWithBackup()
  }
  catch (error) {
    const deployError = new DeployError(
      DeployErrorCode.BACKUP_UPLOAD_FAILED,
      `备份文件 ${remoteBackupFileFullName} 创建失败`,
      error,
      serverName
    )
    logger.serverLog(serverName, deployError.message, LogLevel.ERROR)
    throw deployError
  }

  async function proceedWithBackup() {
    // 检查备份文件是否已存在
    if (await checkBackupExists()) {
      logger.serverLog(serverName, `备份文件 ${remoteBackupFileFullName} 已存在，跳过备份`, LogLevel.WARNING)
      return
    }

    // 尝试远程复制策略
    const copySuccess = await tryRemoteCopy()
    if (copySuccess) {
      await handleBackupSuccess()
      return
    }

    // 远程复制失败，尝试降级到上传策略
    const uploadSuccess = await tryFallbackUpload()
    if (uploadSuccess) {
      await handleBackupSuccess()
      return
    }

    // 两种策略都失败，记录警告但不阻塞流程
    logger.serverLog(
      serverName,
      '备份创建失败：远程文件不存在且本地文件不可用，跳过备份步骤',
      LogLevel.WARNING
    )
  }

  /**
   * 检查备份文件是否已存在
   */
  async function checkBackupExists(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      sftp.stat(remoteBackupFileFullName, (statErr) => {
        resolve(!statErr) // 如果没有错误，说明文件存在
      })
    })
  }

  /**
   * 尝试使用远程复制命令创建备份
   */
  async function tryRemoteCopy(): Promise<boolean> {
    // 首先检查源文件是否存在
    const sourceExists = await new Promise<boolean>((resolve) => {
      sftp.stat(remoteZipPath, (statErr) => {
        resolve(!statErr)
      })
    })

    if (!sourceExists) {
      logger.serverLog(
        serverName,
        `远程源文件 ${remoteZipPath} 不存在，可能使用了 customUpload 自定义上传逻辑`,
        LogLevel.WARNING
      )
      return false
    }

    logger.serverLog(serverName, `使用远程复制创建备份：${remoteBackupFileFullName}`)

    return executeRemoteCopy()
  }

  /**
   * 执行远程复制命令
   */
  async function executeRemoteCopy(): Promise<boolean> {
    const copyCommand = `cp "${remoteZipPath}" "${remoteBackupFileFullName}"`

    return new Promise<boolean>((resolve) => {
      sshServer.exec(copyCommand, (err, stream) => {
        if (err) {
          logger.serverLog(
            serverName,
            `远程复制命令执行失败: ${err.message}`,
            LogLevel.WARNING
          )
          return resolve(false)
        }

        let stderrOutput = ''
        stream.on('close', (code: number | null, signal?: string) => {
          if (code !== 0) {
            logger.serverLog(
              serverName,
              `远程复制失败，退出码 ${code}${signal ? ` (信号: ${signal})` : ''}`,
              LogLevel.WARNING
            )
            return resolve(false)
          }

          logger.serverLog(serverName, '远程复制备份成功', LogLevel.SUCCESS)
          resolve(true)
        }).on('data', (data: Buffer) => {
          const output = data.toString().trim()
          if (output) {
            logger.serverLog(serverName, `复制命令输出: ${output}`)
          }
        }).stderr.on('data', (data: Buffer) => {
          stderrOutput += data.toString()
          const errorOutput = data.toString().trim()
          if (errorOutput) {
            logger.serverLog(serverName, `复制命令错误: ${errorOutput}`, LogLevel.WARNING)
          }
        })
      })
    })
  }

  /**
   * 降级策略：尝试从本地上传文件作为备份
   */
  async function tryFallbackUpload(): Promise<boolean> {
    if (!localZipPath) {
      logger.serverLog(
        serverName,
        '没有提供本地压缩文件路径，无法使用上传降级策略',
        LogLevel.WARNING
      )
      return false
    }

    logger.serverLog(
      serverName,
      `远程复制失败，尝试降级策略：从本地上传 ${localZipPath}`,
      LogLevel.WARNING
    )

    return executeFallbackUpload()
  }

  /**
   * 执行降级上传
   */
  async function executeFallbackUpload(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      sftp.fastPut(
        localZipPath!,
        remoteBackupFileFullName,
        {
          step: (current, _nb, total) => {
            updateProgress(current, total, (percent, progressText) => {
              logger.progress({
                message: '降级备份上传进度:',
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
        (uploadErr) => {
          if (uploadErr) {
            logger.serverLog(
              serverName,
              `降级备份上传失败: ${uploadErr.message}`,
              LogLevel.WARNING
            )
            return resolve(false)
          }

          logger.serverLog(serverName, '降级备份上传成功', LogLevel.SUCCESS)
          resolve(true)
        }
      )
    })
  }

  /**
   * 处理备份成功后的清理工作
   */
  async function handleBackupSuccess() {
    try {
      await clearOldBackup()
    }
    catch (cleanupError) {
      // 清理失败不应阻塞主流程
      logger.serverLog(serverName, '清理旧备份失败，但不影响主流程', LogLevel.WARNING)
    }
  }

  async function clearOldBackup() {
    if (maxBackupCount && maxBackupCount > 0) {
      try {
        const files = await new Promise<any[]>((res, rej) => {
          sftp.readdir(remoteBackupDir, (err, list) => {
            if (err) return rej(err)
            res(list)
          })
        })

        const backupFiles = files
          .filter(file => file.filename.endsWith('.tar.gz'))
          .sort((a, b) => a.attrs.mtime - b.attrs.mtime) // 按修改时间升序排序，旧的在前

        if (backupFiles.length > maxBackupCount) {
          const filesToDelete = backupFiles.slice(0, backupFiles.length - maxBackupCount)

          for (const fileToDelete of filesToDelete) {
            const filePathToDelete = toUnixPath(join(remoteBackupDir, fileToDelete.filename))

            await new Promise<void>((resDel, rejDel) => {
              sftp.unlink(filePathToDelete, (delErr) => {
                if (delErr) {
                  logger.serverLog(serverName, `删除旧备份文件 ${filePathToDelete} 失败`, LogLevel.ERROR)
                  // 不阻塞后续操作，只记录错误
                }
                else {
                  logger.serverLog(serverName, `已删除旧备份文件 ${filePathToDelete}`, LogLevel.SUCCESS)
                }
                resDel()
              })
            })
          }
        }
      }
      catch (cleanupErr) {
        throw new DeployError(
          DeployErrorCode.BACKUP_CLEANUP_FAILED,
          '清理旧备份时出错',
          cleanupErr,
          serverName
        )
      }
    }
  }
}


type BackupOpts = {
  sftp: SFTPWrapper
  connectInfo: ConnectInfo
  remoteBackupDir: string
  remoteZipPath: string
  localZipPath?: string
  maxBackupCount?: number
  sshServer: Client
}
