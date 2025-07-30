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
import { dirname } from 'node:path'
import { InteractiveDeployer, showInteractiveModeInfo, showAutoModeInfo } from './interactive'


export async function deploy(deployOpts: DeployOpts) {
  const startTime = Date.now()
  const sshServers: Client[] = []
  const opts = getOpts(deployOpts)

  logger.title('开始部署流程')

  // 显示模式提示信息
  if (opts.interactive) {
    showInteractiveModeInfo()
  }
  else {
    showAutoModeInfo()
  }

  // 验证必要配置
  try {
    if (
      !opts.distDir
      || !opts.zipPath
      || !opts.remoteZipPath
      || !opts.remoteUnzipDir
    ) {
      throw new Error('distDir, zipPath, remoteZipPath, remoteUnzipDir 必须配置')
    }

    // 检查 remoteUnzipDir 不能与 remoteZipPath 目录相同
    const remoteZipDir = dirname(opts.remoteZipPath)
    if (remoteZipDir === opts.remoteUnzipDir) {
      throw new Error('remoteUnzipDir 不能与 remoteZipPath 的目录相同，因为部署过程会先删除 remoteUnzipDir')
    }
  }
  catch (error) {
    logger.error('配置验证失败', error)
    throw error
  }

  // 显示部署配置信息
  logger.table({
    '部署目标': opts.connectInfos.map(info => info.name || info.host).join(', '),
    '构建命令': opts.buildCmd,
    '跳过构建': opts.skipBuild ? '是' : '否',
    '交互模式': opts.interactive ? '是' : '否',
    '本地构建目录': opts.distDir,
    '远程部署路径': opts.remoteUnzipDir,
  })

  // 创建交互处理器
  const interactiveDeployer = opts.interactive
    ? new InteractiveDeployer(opts)
    : null

  try {
    // 构建阶段
    logger.stage('构建阶段')

    if (interactiveDeployer) {
      const shouldContinue = await interactiveDeployer.confirmBuildStage()
      if (!shouldContinue) {
        interactiveDeployer.handleUserCancel('构建')
        return
      }
    }

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

    // 压缩阶段
    logger.stage('压缩阶段')

    if (interactiveDeployer) {
      const shouldContinue = await interactiveDeployer.confirmCompressStage()
      if (!shouldContinue) {
        interactiveDeployer.handleUserCancel('压缩')
        return
      }
    }

    await startZip(opts)

    // 上传和部署阶段
    logger.stage('上传和部署阶段')

    if (interactiveDeployer) {
      const shouldContinue = await interactiveDeployer.confirmUploadAndDeployStage()
      if (!shouldContinue) {
        interactiveDeployer.handleUserCancel('上传和部署')
        return
      }
    }

    const singleConnectInfo = splitDeployOpts(opts)
    logger.info(`准备部署到 ${singleConnectInfo.length} 个服务器`)

    // 记录部署结果
    let successCount = 0
    let failCount = 0

    for (const item of singleConnectInfo) {
      try {
        const currentSShServers = deployOpts.customUpload
          ? await deployOpts.customUpload(() => new Client(), opts.connectInfos)
          : await connectAndUpload(item)

        sshServers.push(...currentSShServers)

        if (currentSShServers.length > 0) {
          deployOpts.customDeploy
            ? await deployOpts.customDeploy(currentSShServers, item.connectInfos)
            : await unzipAndDeploy(currentSShServers, item.deployCmd)

          successCount++
          logger.success(`服务器 ${item.connectInfos[0].name || item.connectInfos[0].host} 部署成功`)
        }
      }
      catch (error) {
        failCount++
        logger.error(`服务器 ${item.connectInfos[0].name || item.connectInfos[0].host} 部署失败`, error)
        // 继续处理其他服务器，不中断流程
      }
    }

    // 清理阶段
    logger.stage('清理阶段')

    if (interactiveDeployer) {
      const shouldContinue = await interactiveDeployer.confirmCleanupStage()
      if (!shouldContinue) {
        logger.info('用户跳过了清理阶段')
      }
      else if (opts.needRemoveZip) {
        logger.info(`清理本地临时文件: ${opts.zipPath}`)
        rmSync(opts.zipPath)
      }
    }
    else {
      if (opts.needRemoveZip) {
        logger.info(`清理本地临时文件: ${opts.zipPath}`)
        rmSync(opts.zipPath)
      }
    }

    // 部署完成，显示统计信息
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    logger.title('部署完成')
      logger.table({
        '部署总数': singleConnectInfo.length.toString(),
        '成功数量': successCount.toString(),
        '失败数量': failCount.toString(),
        '总耗时': `${duration} 秒`,
      })

      if (failCount > 0) {
        logger.warning('部分服务器部署失败，请检查日志')
      }
      else {
        logger.success('所有服务器部署成功')
      }
  }
  catch (error: any) {
    logger.error('部署过程中发生错误', error)
    throw error // 重新抛出错误，让调用者能够捕获
  }
  finally {
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