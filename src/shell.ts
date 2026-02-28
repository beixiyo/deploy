import { Client, type SFTPWrapper } from 'ssh2'
import { logger } from './logger'
import { DeployErrorCode, DeployError, LogLevel } from './types'
import type { ConnectInfo, HookShell, PartRequiredDeployOpts, RemoteShellOptions, ShellExecResult } from './types'

function resolveTargetServer(
  init: HookShellInitContext,
  options?: RemoteShellOptions
): { connectInfo: ConnectInfo; serverIndex: number; serverName: string } {
  const { opts, connectInfo: ctxConnectInfo, serverIndex: ctxIndex } = init

  if (!opts.connectInfos || opts.connectInfos.length === 0) {
    throw new DeployError(
      DeployErrorCode.CONNECT_SSH_FAILED,
      '没有可用的服务器连接信息，无法执行远程命令'
    )
  }

  let index: number

  if (typeof options?.serverIndex === 'number') {
    index = options.serverIndex
  }
  else if (typeof ctxIndex === 'number') {
    index = ctxIndex
  }
  else if (ctxConnectInfo) {
    index = opts.connectInfos.findIndex(item => item.host === ctxConnectInfo.host && item.port === ctxConnectInfo.port)
    if (index < 0) {
      index = 0
    }
  }
  else {
    index = 0
  }

  const connectInfo = opts.connectInfos[index]

  if (!connectInfo) {
    throw new DeployError(
      DeployErrorCode.CONNECT_SSH_FAILED,
      `根据 serverIndex=${index} 未找到对应的服务器信息`
    )
  }

  const serverName = connectInfo.name || connectInfo.host

  return {
    connectInfo,
    serverIndex: index,
    serverName
  }
}

async function withSshClient<T>(
  connectInfo: ConnectInfo,
  serverName: string,
  task: (client: Client) => Promise<T>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const sshServer = new Client()

    sshServer
      .on('ready', async () => {
        try {
          const result = await task(sshServer)
          sshServer.end()
          sshServer.destroy()
          resolve(result)
        }
        catch (err) {
          sshServer.end()
          sshServer.destroy()
          reject(err)
        }
      })
      .on('error', (err) => {
        logger.serverLog(serverName, `远程 Shell 连接失败: ${err.message}`, LogLevel.ERROR)
        reject(new DeployError(
          DeployErrorCode.CONNECT_SSH_FAILED,
          `远程 Shell 连接失败: ${err.message}`,
          err,
          serverName
        ))
      })
      .connect(connectInfo)
  })
}

async function runRemoteCommand(
  init: HookShellInitContext,
  cmd: string,
  options: RemoteShellOptions | undefined,
  streaming: boolean
): Promise<ShellExecResult> {
  const { opts } = init
  const { connectInfo, serverName } = resolveTargetServer(init, options)

  const cwd = (options?.cwd || opts.remoteCwd || '/').trim()
  const remoteCmd = cwd ? `cd ${cwd} && ${cmd}` : cmd

  logger.serverLog(serverName, `执行远程命令: ${remoteCmd}`, LogLevel.INFO)

  return withSshClient(connectInfo, serverName, (sshServer) => {
    return new Promise<ShellExecResult>((resolve, reject) => {
      sshServer.exec(remoteCmd, (err, stream) => {
        if (err) {
          logger.serverLog(serverName, `远程命令启动失败: ${err.message}`, LogLevel.ERROR)
          return reject(new DeployError(
            DeployErrorCode.DEPLOY_COMMAND_FAILED,
            `远程命令启动失败: ${err.message}`,
            err,
            serverName
          ))
        }

        let stdout = ''
        let stderr = ''

        stream.on('data', (data: Buffer) => {
          const text = data.toString()
          stdout += text
          if (streaming) {
            logger.serverLog(serverName, text.trim(), LogLevel.INFO)
          }
        })

        stream.stderr.on('data', (data: Buffer) => {
          const text = data.toString()
          stderr += text
          if (streaming) {
            logger.serverLog(serverName, text.trim(), LogLevel.ERROR)
          }
        })

        stream.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
          if (code === 0) {
            logger.serverLog(serverName, '远程命令执行成功', LogLevel.SUCCESS)
          }
          else {
            logger.serverLog(
              serverName,
              `远程命令执行失败 (退出码: ${code ?? 'null'}, 信号: ${signal ?? 'null'})`,
              LogLevel.ERROR
            )
          }

          resolve({
            stdout,
            stderr,
            code,
            signal: signal ?? null
          })
        })
      })
    })
  })
}

async function runSftpTask<T>(
  init: HookShellInitContext,
  task: (sftp: SFTPWrapper) => Promise<T>,
  options?: RemoteShellOptions
): Promise<T> {
  const { connectInfo, serverName } = resolveTargetServer(init, options)

  logger.serverLog(serverName, '建立 SFTP 连接', LogLevel.INFO)

  return withSshClient(connectInfo, serverName, (sshServer) => {
    return new Promise<T>((resolve, reject) => {
      sshServer.sftp((err, sftp) => {
        if (err) {
          logger.serverLog(serverName, `SFTP 初始化失败: ${err.message}`, LogLevel.ERROR)
          return reject(new DeployError(
            DeployErrorCode.CONNECT_SFTP_FAILED,
            `SFTP 初始化失败: ${err.message}`,
            err,
            serverName
          ))
        }
        task(sftp!)
          .then(resolve)
          .catch(reject)
      })
    })
  })
}

/**
 * 为 Hook 创建远程 Shell 工具
 */
export function createHookShell(init: HookShellInitContext): HookShell {
  return {
    exec(cmd: string, options?: RemoteShellOptions): Promise<ShellExecResult> {
      return runRemoteCommand(init, cmd, options, false)
    },

    spawn(cmd: string, options?: RemoteShellOptions): Promise<ShellExecResult> {
      return runRemoteCommand(init, cmd, options, true)
    },

    sftp<T>(task: (sftp: SFTPWrapper) => Promise<T>, options?: RemoteShellOptions): Promise<T> {
      return runSftpTask(init, task, options)
    }
  }
}

interface HookShellInitContext {
  opts: PartRequiredDeployOpts
  connectInfo?: ConnectInfo
  serverIndex?: number
}
