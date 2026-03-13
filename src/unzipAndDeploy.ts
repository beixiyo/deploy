import { Client } from 'ssh2'
import { logger } from './logger'
import { LogLevel, type ConnectInfo } from './types'
import { DeployErrorCode, DeployError } from './types'


/**
 * 获取服务器显示名称：优先使用 name，没有则使用 host
 */
function getServerDisplayName(connectInfo: ConnectInfo, index: number): string {
  return connectInfo.name || connectInfo.host || `#${index}`
}

/**
 * 解压并部署
 */
export async function unzipAndDeploy(
  sshServers: Client[],
  deployCmd: string,
  connectInfos: ConnectInfo[]
) {
  if (sshServers.length === 0) {
    logger.warning('没有可用的服务器连接，跳过解压和部署')
    return
  }

  logger.info(`开始在 ${sshServers.length} 台服务器上执行部署命令`)
  logger.debug(`部署命令: ${deployCmd}`)

  // 使用 Promise.allSettled 替代 Promise.all
  const results = await Promise.allSettled(
    sshServers.map((sshServer, index) => executeDeployCommand(sshServer, deployCmd, connectInfos[index], index))
  )

  // 处理结果
  let successCount = 0
  let failCount = 0

  results.forEach((result, index) => {
    const serverDisplayName = getServerDisplayName(connectInfos[index], index)

    if (result.status === 'fulfilled') {
      successCount++
    }
    else {
      failCount++
      logger.error(`服务器 ${serverDisplayName} 部署失败: ${result.reason}`)
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
 * 在单个服务器上执行部署命令。
 * 使用 exec() 而非 shell()：exec 以非交互模式运行，命令结束后 stream 自动关闭，
 * 不受服务器登录 shell 类型（bash/zsh/fish）和初始化脚本的影响。
 */
function executeDeployCommand(
  sshServer: Client,
  deployCmd: string,
  connectInfo: ConnectInfo,
  serverIndex: number
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const serverDisplayName = getServerDisplayName(connectInfo, serverIndex)

    logger.info(`服务器 ${serverDisplayName} 开始执行部署命令`)
    logger.info(deployCmd)

    sshServer.exec(deployCmd, (err, stream) => {
      if (err) {
        logger.error(`服务器 ${serverDisplayName} 执行命令失败`, err)
        return reject(new DeployError(
          DeployErrorCode.DEPLOY_SHELL_FAILED,
          `服务器 ${serverDisplayName} 执行命令失败`,
          err,
          serverDisplayName
        ))
      }

      let errorOutput = ''

      stream.on('data', (data: Buffer) => {
        const text = data.toString().trim()
        if (text) {
          logger.serverLog(serverDisplayName, text, LogLevel.INFO)
        }
      })

      stream.stderr.on('data', (data: Buffer) => {
        const error = data.toString().trim()
        if (error) {
          errorOutput += error + '\n'
          logger.serverLog(serverDisplayName, `错误: ${error}`, LogLevel.ERROR)
        }
      })

      stream.on('close', (code: number | null) => {
        if (code === 0 || code === null) {
          logger.serverLog(serverDisplayName, '部署命令执行成功', LogLevel.SUCCESS)
          resolve()
        }
        else {
          const errorMsg = `部署命令执行失败 (退出码: ${code})`
          logger.serverLog(serverDisplayName, errorMsg, LogLevel.ERROR)
          reject(new DeployError(
            DeployErrorCode.DEPLOY_COMMAND_FAILED,
            errorMsg,
            { exitCode: code, errorOutput, deployCmd },
            serverDisplayName
          ))
        }
      })
    })
  })
}
