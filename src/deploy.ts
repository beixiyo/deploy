import { Client } from 'ssh2'
import { build } from './build'
import type { DeployOpts, BuildHookContext, CompressHookContext, ConnectHookContext, DeployHookContext, CleanupHookContext } from './types'
import { startZip } from './startZip'
import { connectAndUpload } from './connectAndUpload'
import { unzipAndDeploy } from './unzipAndDeploy'
import { rmSync, existsSync } from 'node:fs'
import { getOpts } from './getOpts'
import { logger } from './logger'
import { dirname } from 'node:path'
import { InteractiveDeployer, showInteractiveModeInfo, showAutoModeInfo } from './interactive'
import { executeHook, handleError } from './hookAndError'
import { DeployErrorCode, DeployError } from './types'


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
      throw new DeployError(
        DeployErrorCode.CONFIG_MISSING_REQUIRED,
        'distDir, zipPath, remoteZipPath, remoteUnzipDir 必须配置'
      )
    }

    // 检查 remoteUnzipDir 不能与 remoteZipPath 目录相同
    const remoteZipDir = dirname(opts.remoteZipPath)
    if (remoteZipDir === opts.remoteUnzipDir) {
      throw new DeployError(
        DeployErrorCode.CONFIG_VALIDATION_FAILED,
        'remoteUnzipDir 不能与 remoteZipPath 的目录相同，因为部署过程会先删除 remoteUnzipDir'
      )
    }
  }
  catch (error) {
    const errorHandled = await handleError(
      error as Error,
      opts.onError,
      {
        opts,
        stage: 'validation',
        startTime,
        canRetry: false
      }
    )

    if (!errorHandled) {
      logger.error('配置验证失败', error)
      throw error
    }
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

    const buildContext: BuildHookContext = {
      opts,
      stage: 'build',
      startTime,
      buildCmd: opts.buildCmd,
      skipBuild: opts.skipBuild
    }

    try {
      await executeHook(opts.onBeforeBuild, buildContext)

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
          throw new DeployError(
            DeployErrorCode.BUILD_DIST_NOT_FOUND,
            `跳过构建，但构建产物目录 ${opts.distDir} 不存在，请先执行构建或关闭 skipBuild 选项`
          )
        }
      }
      else {
        await build(opts.buildCmd)
      }

      await executeHook(opts.onAfterBuild, buildContext)
    }
    catch (error) {
      const errorHandled = await handleError(
        error as Error,
        opts.onError,
        {
          opts,
          stage: 'build',
          startTime,
          canRetry: false
        }
      )

      if (!errorHandled) {
        throw error
      }
    }

    // 压缩阶段
    logger.stage('压缩阶段')

    const compressContext: CompressHookContext = {
      opts,
      stage: 'compress',
      startTime,
      distDir: opts.distDir,
      zipPath: opts.zipPath
    }

    try {
      await executeHook(opts.onBeforeCompress, compressContext)

      if (interactiveDeployer) {
        const shouldContinue = await interactiveDeployer.confirmCompressStage()
        if (!shouldContinue) {
          interactiveDeployer.handleUserCancel('压缩')
          return
        }
      }

      await startZip(opts)
      await executeHook(opts.onAfterCompress, compressContext)
    }
    catch (error) {
      const errorHandled = await handleError(
        error as Error,
        opts.onError,
        {
          opts,
          stage: 'compress',
          startTime,
          canRetry: false
        }
      )

      if (!errorHandled) {
        throw error
      }
    }

    // 上传和部署阶段
    logger.stage('上传和部署阶段')

    const connectContext: ConnectHookContext = {
      opts,
      stage: 'connect',
      startTime,
      connectInfos: opts.connectInfos,
      concurrent: opts.concurrent
    }

    try {
      await executeHook(opts.onBeforeConnect, connectContext)

      if (interactiveDeployer) {
        const shouldContinue = await interactiveDeployer.confirmUploadAndDeployStage()
        if (!shouldContinue) {
          interactiveDeployer.handleUserCancel('上传和部署')
          return
        }
      }

      await executeHook(opts.onAfterConnect, connectContext)
    }
    catch (error) {
      const errorHandled = await handleError(
        error as Error,
        opts.onError,
        {
          opts,
          stage: 'connect',
          startTime,
          canRetry: false
        }
      )

      if (!errorHandled) {
        throw error
      }
    }

    logger.info(`准备部署到 ${opts.connectInfos.length} 个服务器`)
    logger.info(`部署模式: ${opts.concurrent ? '并发模式' : '串行模式'}`)

    // 记录部署结果
    let successCount = 0
    let failCount = 0

    if (opts.concurrent) {
      // 并发模式：同时部署所有服务器
      await deployConcurrent()
    }
    else {
      // 串行模式：逐个部署服务器
      await deploySequential()
    }

    async function deployConcurrent() {
      const deployContext: DeployHookContext = {
        opts,
        stage: 'deploy',
        startTime,
        deployCmd: opts.deployCmd,
        sshClients: []
      }

      try {
        await executeHook(opts.onBeforeDeploy, deployContext)

        // 自定义上传或使用默认上传
        const currentSShServers = deployOpts.customUpload
          ? await deployOpts.customUpload(() => new Client(), opts.connectInfos)
          : await connectAndUpload(opts)

        sshServers.push(...currentSShServers)
        deployContext.sshClients = currentSShServers

        if (currentSShServers.length > 0) {
          // 自定义部署或使用默认部署
          deployOpts.customDeploy
            ? await deployOpts.customDeploy(currentSShServers, opts.connectInfos)
            : await unzipAndDeploy(currentSShServers, opts.deployCmd)

          successCount = opts.connectInfos.length
          logger.success('所有服务器部署成功')
        }

        await executeHook(opts.onAfterDeploy, deployContext)
      }
      catch (error) {
        failCount = opts.connectInfos.length

        const errorHandled = await handleError(
          error as Error,
          opts.onError,
          {
            opts,
            stage: 'deploy',
            startTime,
            canRetry: false
          }
        )

        if (!errorHandled) {
          logger.error('并发部署失败', error)
          throw error
        }
      }
    }

    async function deploySequential() {
      // 串行模式：为每个服务器单独处理
      for (let i = 0; i < opts.connectInfos.length; i++) {
        const connectInfo = opts.connectInfos[i]
        const serverName = connectInfo.name || connectInfo.host

        const deployContext: DeployHookContext = {
          opts,
          stage: 'deploy',
          startTime,
          connectInfo,
          serverIndex: i,
          deployCmd: opts.deployCmd,
          sshClients: []
        }

        try {
          logger.info(`开始部署服务器 ${i + 1}/${opts.connectInfos.length}: ${serverName}`)

          await executeHook(opts.onBeforeDeploy, deployContext)

          // 创建单个服务器的配置
          const singleServerOpts = {
            ...opts,
            connectInfos: [connectInfo]
          }

          // 自定义上传或使用默认上传
          const currentSShServers = deployOpts.customUpload
            ? await deployOpts.customUpload(() => new Client(), [connectInfo])
            : await connectAndUpload(singleServerOpts)

          sshServers.push(...currentSShServers)
          deployContext.sshClients = currentSShServers

          if (currentSShServers.length > 0) {
            // 自定义部署或使用默认部署
            deployOpts.customDeploy
              ? await deployOpts.customDeploy(currentSShServers, [connectInfo])
              : await unzipAndDeploy(currentSShServers, opts.deployCmd)

            successCount++
            logger.success(`服务器 ${serverName} 部署成功`)
          }

          await executeHook(opts.onAfterDeploy, deployContext)
        }
        catch (error) {
          failCount++

          const errorHandled = await handleError(
            error as Error,
            opts.onError,
            {
              opts,
              stage: 'deploy',
              startTime,
              connectInfo,
              serverIndex: i,
              canRetry: false
            }
          )

          if (!errorHandled) {
            logger.error(`服务器 ${serverName} 部署失败`, error)
            // 继续处理其他服务器，不中断流程
          }
        }
      }
    }

    // 清理阶段
    logger.stage('清理阶段')

    const cleanupContext: CleanupHookContext = {
      opts,
      stage: 'cleanup',
      startTime,
      zipPath: opts.zipPath,
      needRemoveZip: opts.needRemoveZip
    }

    try {
      await executeHook(opts.onBeforeCleanup, cleanupContext)

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

      await executeHook(opts.onAfterCleanup, cleanupContext)
    }
    catch (error) {
      const errorHandled = await handleError(
        error as Error,
        opts.onError,
        {
          opts,
          stage: 'cleanup',
          startTime,
          canRetry: false
        }
      )

      if (!errorHandled) {
        logger.error('清理阶段失败', error)
        // 清理失败不应阻塞主流程，仅记录警告
        logger.warning('清理失败，但不影响部署结果')
      }
    }

    // 部署完成，显示统计信息
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    logger.title('部署完成')
    logger.table({
      '部署总数': opts.connectInfos.length.toString(),
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
    const errorHandled = await handleError(
      error,
      opts.onError,
      {
        opts,
        stage: 'unknown',
        startTime,
        canRetry: false
      }
    )

    if (!errorHandled) {
      logger.error('部署过程中发生错误', error)
      throw error // 重新抛出错误，让调用者能够捕获
    }
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