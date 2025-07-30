import { Client, type SFTPWrapper } from 'ssh2'
import type { ConnectInfo } from './types'
import { ensureRemoteDirExists, getLocalToday, toUnixPath, updateProgress } from './tool'
import { join } from 'node:path'
import { logger, LogLevel } from './logger'


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
    console.error(`---${connectInfo.name ?? ''}: 备份文件 ${remoteBackupFileFullName} 上传失败 (${remoteBackupFileFullName})---`, error)
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
                logger.serverLog(connectInfo.name ?? '', `备份压缩包上传失败 (${remoteBackupFileFullName})`, LogLevel.ERROR)
                return reject(backupUploadErr)
              }
              logger.serverLog(connectInfo.name ?? '', `备份压缩包上传成功 (${remoteBackupFileFullName})`, LogLevel.SUCCESS)

              await clearOldBackup()
              resolve()
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
        logger.serverLog(connectInfo.name ?? '', '清理旧备份时出错', LogLevel.ERROR)
        // 清理失败不应阻塞主流程
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
