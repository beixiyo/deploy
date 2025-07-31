import { Client } from 'ssh2'
import { logger } from './logger'
import { LogLevel } from './types'
import { DeployErrorCode, DeployError } from './types'


/**
 * 解压并部署
 */
export async function unzipAndDeploy(
  sshServers: Client[],
  deployCmd: string
) {
  if (sshServers.length === 0) {
    logger.warning('没有可用的服务器连接，跳过解压和部署')
    return
  }

  logger.info(`开始在 ${sshServers.length} 台服务器上执行部署命令`)
  logger.debug(`部署命令: ${deployCmd}`)

  // 使用 Promise.allSettled 替代 Promise.all
  const results = await Promise.allSettled(
    sshServers.map((sshServer, index) => executeDeployCommand(sshServer, deployCmd, index))
  )

  // 处理结果
  let successCount = 0
  let failCount = 0

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successCount++
    } else {
      failCount++
      logger.error(`服务器 #${index} 部署失败: ${result.reason}`)
    }
  })

  // 显示总结
  if (failCount > 0) {
    logger.warning(`部署命令执行结果: ${successCount} 台成功，${failCount} 台失败`)

    // 如果全部失败，抛出错误
    if (successCount === 0) {
      throw new DeployError(
        DeployErrorCode.DEPLOY_COMMAND_FAILED,
        '所有服务器部署命令执行失败'
      )
    }
  }
  else {
    logger.success(`所有 ${successCount} 台服务器部署命令执行成功`)
  }
}

/**
 * 在单个服务器上执行部署命令
 */
function executeDeployCommand(
  sshServer: Client,
  deployCmd: string,
  serverIndex: number
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    logger.info(`服务器 #${serverIndex} 开始执行部署命令`)
    logger.info(deployCmd)

    sshServer.shell((err, stream) => {
      if (err) {
        logger.error(`服务器 #${serverIndex} 创建 shell 失败`, err)
        return reject(new DeployError(
          DeployErrorCode.DEPLOY_SHELL_FAILED,
          `服务器 #${serverIndex} 创建 shell 失败`,
          err,
          `#${serverIndex}`
        ))
      }

      let hasExited = false
      let errorOutput = ''

      stream
        .on('exit', (code) => {
          hasExited = true
          if (code === 0) {
            logger.serverLog(`#${serverIndex}`, '部署命令执行成功', LogLevel.SUCCESS)
            resolve()
          }
          else {
            const errorMsg = `部署命令执行失败 (退出码: ${code})`
            logger.serverLog(`#${serverIndex}`, errorMsg, LogLevel.ERROR)
            reject(new DeployError(
              DeployErrorCode.DEPLOY_COMMAND_FAILED,
              errorMsg,
              { exitCode: code, errorOutput, deployCmd },
              `#${serverIndex}`
            ))
          }
        })
        .on('close', () => {
          // 如果流关闭但没有收到 exit 事件，可能是异常关闭
          if (!hasExited) {
            const errorMsg = '部署命令执行过程中连接异常关闭'
            logger.serverLog(`#${serverIndex}`, errorMsg, LogLevel.ERROR)
            reject(new DeployError(
              DeployErrorCode.DEPLOY_COMMAND_FAILED,
              errorMsg,
              { errorOutput, deployCmd },
              `#${serverIndex}`
            ))
          }
        })
        .stderr.on('data', data => {
          const error = data.toString().trim()
          if (error) {
            errorOutput += error + '\n'
            logger.serverLog(`#${serverIndex}`, `错误: ${error}`, LogLevel.ERROR)
          }
        })

      stream.end(deployCmd)
    })
  })
}