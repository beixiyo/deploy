import { Client, type SFTPWrapper } from 'ssh2';
import type { ConnectInfo } from './types';
import { ensureRemoteDirExists, getLocalToday, toUnixPath } from './tool';
import { join } from 'node:path';


export async function backup(
  {
    sftp,
    connectInfo,
    remoteBackupPath,
    zipPath,
    maxBackupCount,
    sshServer
  }: BackupOpts
) {
  const backupFileName = `${getLocalToday()}.tar.gz`
  const remoteBackupFileFullName = toUnixPath(join(remoteBackupPath, backupFileName))

  try {
    // 确保远程备份目录存在
    await ensureRemoteDirExists(sshServer, sftp, remoteBackupPath)
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
          console.log(`---${connectInfo.name ?? ''}: 准备上传备份文件到 ${remoteBackupFileFullName}---`)

          sftp.fastPut(zipPath, remoteBackupFileFullName, {}, async (backupUploadErr) => {
            if (backupUploadErr) {
              console.error(`---${connectInfo.name ?? ''}: 备份压缩包上传失败 (${remoteBackupFileFullName})---`, backupUploadErr)
              return reject(backupUploadErr)
            }
            console.log(`---${connectInfo.name ?? ''}: 备份压缩包上传成功 (${remoteBackupFileFullName})---`)

            await clearOldBackup()
            resolve()
          })
        }
        else {
          console.warn(`---${connectInfo.name ?? ''}: 备份文件 ${remoteBackupFileFullName} 已存在，跳过备份---`)
          resolve()
        }
      })
    })
  }

  async function clearOldBackup() {
    if (maxBackupCount && maxBackupCount > 0) {
      try {
        const files = await new Promise<any[]>((res, rej) => {
          sftp.readdir(remoteBackupPath, (err, list) => {
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
            const filePathToDelete = toUnixPath(join(remoteBackupPath, fileToDelete.filename))

            await new Promise<void>((resDel, rejDel) => {
              sftp.unlink(filePathToDelete, (delErr) => {
                if (delErr) {
                  console.error(`---${connectInfo.name ?? ''}: 删除旧备份文件 ${filePathToDelete} 失败---`, delErr)
                  // 不阻塞后续操作，只记录错误
                }
                else {
                  console.log(`---${connectInfo.name ?? ''}: 已删除旧备份文件 ${filePathToDelete}---`)
                }
                resDel()
              })
            })
          }
        }
      }
      catch (cleanupErr) {
        console.error(`---${connectInfo.name ?? ''}: 清理旧备份时出错---`, cleanupErr)
        // 清理失败不应阻塞主流程
      }
    }
  }
}


type BackupOpts = {
  sftp: SFTPWrapper
  connectInfo: ConnectInfo
  remoteBackupPath: string
  zipPath: string
  maxBackupCount?: number
  sshServer: Client
}
