import type { Client, SFTPWrapper, Stats } from 'ssh2'

/**
 * 失败后自动重试请求
 * @param task 任务函数，返回一个 Promise
 * @param maxCount 剩余重试次数，默认 3
 */
export async function retryTask<T>(
  task: () => Promise<T>,
  maxCount = 3
): Promise<T> {
  return task()
    .then(res => res)
    .catch(async (err) => { // 捕获错误
      const remainingRetries = maxCount - 1
      if (remainingRetries <= 0) {
        console.error('任务失败，重试次数已耗尽:', err)
        return Promise.reject('重试次数耗尽')
      }
      else {
        console.warn(`任务失败，剩余重试次数: ${remainingRetries}`, err)
        // 等待一小段时间再重试，避免立即重试导致连续失败
        await new Promise(resolve => setTimeout(resolve, 300))
        return retryTask(task, remainingRetries)
      }
    })
}

/**
 * 更新进度
 * @param current 当前传输的字节数
 * @param total 总字节数
 * @param onProgress 进度回调函数
 */
export function updateProgress(
  current: number,
  total: number,
  onProgress: (percent: number, progressText: string) => void
) {
  const percent = Math.floor((current / total) * 100)
  const transferredMB = (current / (1024 * 1024)).toFixed(2)
  const totalMB = (total / (1024 * 1024)).toFixed(2)
  const progressText = `${transferredMB}MB / ${totalMB}MB (${percent}%)`
  onProgress(percent, progressText)

  return {
    percent,
    progressText,
    transferredMB,
    totalMB
  }
}

/**
 * 把路径转成类似 unix 风格的路径
 */
export function toUnixPath(path: string): string {
  return path.replace(/\\/g, '/')
}

export function getLocalToday() {
  const d = new Date()
    .toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
    .replace(/\//g, '-')
  const t = new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' })

  return `${d} ${t}`
}

export async function ensureRemoteDirExists(
  sshServer: Client,
  sftp: SFTPWrapper,
  path: string
) {
  try {
    const stats = await new Promise<Stats | null>((statResolve, statReject) => {
      sftp!.stat(path, (err, fileStats) => {
        if (err) {
          // 'No such file' 通常意味着路径不存在，这不是一个致命错误，我们需要处理它
          // ssh2 sftp 的 ENOENT 错误码通常是 2
          if ((err as any).code === 2 || err.message.includes('No such file')) {
            console.log(`SFTP: 路径 ${path} 不存在`)
            statResolve(null) // 表示不存在
          }
          else {
            console.error(`SFTP: Error stating path ${path}:`, err)
            statReject(err)
          }
        }
        else {
          statResolve(fileStats)
        }
      })
    })

    return new Promise<void>(async (resolve, reject) => {
      if (stats) {
        // 路径存在
        if (stats.isFile()) {
          const errMsg = `SFTP: 路径 ${path} 已存在但不是一个目录`
          console.error(errMsg)
          throw new Error(errMsg)
        }
        else if (stats.isDirectory()) {
          resolve() // 目录已存在，任务完成
          return
        }
        else {
          // 既不是文件也不是目录 (例如符号链接到不存在的目标，或其他类型)
          // 根据需求，你可能希望处理这种情况，但对于 "确保目录存在" 的目标，这通常是个问题
          const errMsg = `SFTP: 路径 ${path} 既不是文件也不是目录`
          console.error(errMsg)
          reject(new Error(errMsg))
          throw new Error(errMsg)
        }
      }
      else {
        // 路径不存在，创建它
        console.log(`SFTP: 路径 ${path} 不存在，尝试创建它`)

        // 使用 mkdir -p 来递归创建目录
        // 注意: 确保 remoteBackupDir 对于 shell 是安全的
        const command = `mkdir -p ${path}`
        console.log(`SSH: 执行命令: ${command}`)

        await new Promise<void>((execResolve, execReject) => {
          sshServer.exec(command, (err, stream) => {
            if (err) {
              console.error(`SSH: Error executing command "${command}":`, err)
              return execReject(err)
            }

            let stderrOutput = ''
            stream.on('close', (code: number | null, signal?: string) => {
              if (code !== 0) {
                const errMsg = `SSH: Command "${command}" failed with code ${code}${signal ? ` (signal: ${signal})` : ''}. Stderr: ${stderrOutput}`
                console.error(errMsg)
                execReject(new Error(errMsg))
              }
              else {
                console.log(`SSH: 目录 ${path} 创建成功`)
                execResolve()
              }
            }).on('data', (data: Buffer) => {
              console.log(`SSH STDOUT: ${data.toString().trim()}`)
            }).stderr.on('data', (data: Buffer) => {
              stderrOutput += data.toString()
              console.error(`SSH STDERR: ${data.toString().trim()}`)
            })
          })
        })

        resolve() // 目录创建成功
      }
    })
  }
  catch (statError) {
    throw statError
  }
}