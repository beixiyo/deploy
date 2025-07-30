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
    zipPath,
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
      `备份文件 ${remoteBackupFileFullName} 上传失败`,
      error,
      serverName
    )
    logger.serverLog(serverName, deployError.message, LogLevel.ERROR)
    throw deployError
  }

  function proceedWithBackup() {
    return new Promise<void>((resolve, reject) => {
      // 检查备份文件是否存在
      sftp.stat(remoteBackupFileFullName, (statErr) => {
        // 文件不存在或发生其他错误，尝试上传
        if (statErr) {
          logger.serverLog(connectInfo.name ?? '', `准备上传备份文件到 ${remoteBackupFileFullName}`)

          sftp.fastPut(
            zipPath,
            remoteBackupFileFullName,
            {
              step: (current, _nb, total) => {
                updateProgress(current, total, (percent, progressText) => {
                  logger.progress({
                    message: '备份上传进度:',
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
            async (backupUploadErr) => {
              if (backupUploadErr) {
                const error = new DeployError(
                  DeployErrorCode.BACKUP_UPLOAD_FAILED,
                  `备份压缩包上传失败 (${remoteBackupFileFullName})`,
                  backupUploadErr,
                  serverName
                )
                logger.serverLog(connectInfo.name ?? '', error.message, LogLevel.ERROR)
                return reject(error)
              }

              logger.serverLog(connectInfo.name ?? '', `备份压缩包上传成功 (${remoteBackupFileFullName})`, LogLevel.SUCCESS)

              try {
                await clearOldBackup()
                resolve()
              }
              catch (cleanupError) {
                // 清理失败不应阻塞主流程
                logger.serverLog(connectInfo.name ?? '', '清理旧备份失败，但不影响主流程', LogLevel.WARNING)
                resolve()
              }
            }
          )
        }
        else {
          logger.serverLog(connectInfo.name ?? '', `备份文件 ${remoteBackupFileFullName} 已存在，跳过备份`, LogLevel.WARNING)
          resolve()
        }
      })
    })
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
                  logger.serverLog(connectInfo.name ?? '', `删除旧备份文件 ${filePathToDelete} 失败`, LogLevel.ERROR)
                  // 不阻塞后续操作，只记录错误
                }
                else {
                  logger.serverLog(connectInfo.name ?? '', `已删除旧备份文件 ${filePathToDelete}`, LogLevel.SUCCESS)
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
  zipPath: string
  maxBackupCount?: number
  sshServer: Client
}
