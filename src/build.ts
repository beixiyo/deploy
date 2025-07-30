import { spawn } from 'node:child_process'
import { logger } from './logger'

/**
 * 本地构建项目
 */
export async function build(cmd: string) {
  return new Promise<void>((resolve, reject) => {
    logger.info(`开始执行构建命令: ${cmd}`)

    const proc = spawn(cmd, {
      shell: true,
      stdio: 'inherit'
    })

    proc.on('exit', code => {
      if (code === 0) {
        logger.success('构建成功')
        resolve()
      }
      else {
        const error = new Error('构建失败')
        logger.error('构建失败', error)
        reject(error)
      }
    })
  })
}