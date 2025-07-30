import { Client } from 'ssh2'
import { build } from './build'
import type { DeployOpts } from './types'
import { startZip } from './startZip'
import { connectAndUpload } from './connectAndUpload'
import { unzipAndDeploy } from './unzipAndDeploy'
import { rmSync, existsSync } from 'node:fs'
import { getOpts } from './getOpts'
import { splitDeployOpts } from './tool'
import { logger } from './logger'


export async function deploy(deployOpts: DeployOpts) {
  const sshServers: Client[] = []
  const opts = getOpts(deployOpts)

  if (
    !opts.distDir
    || !opts.zipPath
    || !opts.remoteZipPath
    || !opts.remoteUnzipDir
  ) {
    throw new Error('distDir, zipPath, remoteZipPath, remoteUnzipDir 必须配置')
  }

  if (!opts.connectInfos.length) {
    throw new Error('connectInfos 不能为空')
  }

  try {
    if (opts.skipBuild) {
      logger.info('跳过构建步骤')
      // 检查构建产物是否存在
      if (!existsSync(opts.distDir)) {
        throw new Error(`跳过构建，但构建产物目录 ${opts.distDir} 不存在，请先执行构建或关闭 skipBuild 选项`)
      }
    }
    else {
      await build(opts.buildCmd)
    }

    await startZip(opts)

    const singleConnectInfo = splitDeployOpts(opts)
    logger.info(`准备部署到 ${singleConnectInfo.length} 个服务器`)

    for (const item of singleConnectInfo) {
      const currentSShServers = deployOpts.customUpload
        ? await deployOpts.customUpload(() => new Client())
        : await connectAndUpload(item)

      sshServers.push(...currentSShServers)

      deployOpts.customDeploy
        ? await deployOpts.customDeploy(currentSShServers, item.connectInfos)
        : await unzipAndDeploy(currentSShServers, item.deployCmd)
    }

    if (opts.needRemoveZip) {
      logger.info(`清理本地临时文件: ${opts.zipPath}`)
      rmSync(opts.zipPath)
    }

    logger.success('部署完成')
  }
  catch (error: any) {
    logger.error('部署过程中发生错误', error)
    throw error // 重新抛出错误，让调用者能够捕获
  }
  finally {
    if (sshServers.length > 0) {
      logger.info('关闭所有 SSH 连接')
      sshServers.forEach((item) => {
        try {
          item.end()
          item.destroy()
        }
        catch (err) {
          logger.error('关闭 SSH 连接时发生错误', err)
        }
      })
    }
  }
}