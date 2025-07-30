import { spawn } from 'node:child_process'
import { logger } from './logger'
import { DeployErrorCode, DeployError } from './types'


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
        const error = new DeployError(
          DeployErrorCode.BUILD_COMMAND_FAILED,
          `构建命令执行失败，退出码: ${code}`,
          { exitCode: code, command: cmd }
        )
        logger.error('构建失败', error)
        reject(error)
      }
    })

    proc.on('error', (err) => {
      const error = new DeployError(
        DeployErrorCode.BUILD_COMMAND_FAILED,
        `构建命令执行出错: ${err.message}`,
        { originalError: err, command: cmd }
      )
      logger.error('构建过程中发生错误', error)
      reject(error)
    })
  })
}