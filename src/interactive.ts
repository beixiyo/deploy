import inquirer from 'inquirer'
import { logger } from './logger'
import type { PartRequiredDeployOpts } from './types'

/**
 * 交互式部署处理类
 */
export class InteractiveDeployer {
  private opts: PartRequiredDeployOpts

  constructor(opts: PartRequiredDeployOpts) {
    this.opts = opts
  }

  /**
   * 询问用户是否开始构建阶段
   */
  async confirmBuildStage(): Promise<boolean> {
    if (this.opts.skipBuild) {
      logger.info('构建阶段已跳过（skipBuild = true）')
      return true
    }

    logger.newLine()
    logger.info('🔨 构建阶段准备开始')
    logger.log(`即将执行构建命令: ${this.opts.buildCmd}`)
    logger.log('这将会编译您的项目代码并生成构建产物')

    const { shouldContinue } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldContinue',
        message: '是否继续执行构建？',
        default: true,
      },
    ])

    return shouldContinue
  }

  /**
   * 询问用户是否开始压缩阶段
   */
  async confirmCompressStage(): Promise<boolean> {
    logger.newLine()
    logger.info('📦 压缩阶段准备开始')
    logger.log(`源目录: ${this.opts.distDir}`)
    logger.log(`目标文件: ${this.opts.zipPath}`)
    logger.log('这将会将构建产物压缩为 tar.gz 格式以便上传')

    const { shouldContinue } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldContinue',
        message: '是否继续执行压缩？',
        default: true,
      },
    ])

    return shouldContinue
  }

  /**
   * 询问用户是否开始上传和部署阶段
   */
  async confirmUploadAndDeployStage(): Promise<boolean> {
    logger.newLine()
    logger.info('🚀 上传和部署阶段准备开始')
    logger.log(`目标服务器数量: ${this.opts.connectInfos.length}`)
    logger.log(`服务器列表: ${this.opts.connectInfos.map(info => info.name || info.host).join(', ')}`)
    logger.log(`远程路径: ${this.opts.remoteUnzipDir}`)

    if (this.opts.remoteBackupDir) {
      logger.log(`备份目录: ${this.opts.remoteBackupDir}`)
    }

    logger.log('这将会执行以下操作:')
    logger.log('  1. 连接到所有目标服务器')
    logger.log('  2. 上传压缩包到远程服务器')

    if (this.opts.remoteBackupDir) {
      logger.log('  3. 备份当前压缩包（如果配置了备份）')
    }

    logger.log('  4. 在远程服务器执行部署命令')
    logger.log('  5. 解压并部署新版本')

    const { shouldContinue } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldContinue',
        message: '是否继续执行上传和部署？',
        default: true,
      },
    ])

    return shouldContinue
  }

  /**
   * 询问用户是否开始清理阶段
   */
  async confirmCleanupStage(): Promise<boolean> {
    if (!this.opts.needRemoveZip) {
      logger.info('清理阶段已跳过（needRemoveZip = false）')
      return true
    }

    logger.newLine()
    logger.info('🧹 清理阶段准备开始')
    logger.log(`即将删除本地临时文件: ${this.opts.zipPath}`)
    logger.log('这将会清理部署过程中生成的临时压缩文件')

    const { shouldContinue } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldContinue',
        message: '是否继续执行清理？',
        default: true,
      },
    ])

    return shouldContinue
  }

  /**
   * 处理用户取消操作
   */
  handleUserCancel(stage: string): void {
    logger.warning(`用户取消了 ${stage} 阶段`)
    logger.info('部署流程已中止')
    process.exit(0)
  }
}

/**
 * 显示交互模式提示信息
 */
export function showInteractiveModeInfo(): void {
  logger.info('🤝 交互式部署模式已启用')
  logger.log('在每个部署阶段之前，系统将询问您是否继续执行')
  logger.log('您可以通过设置 interactive: false 来启用全自动部署模式')
  logger.divider()
}

/**
 * 显示自动模式提示信息
 */
export function showAutoModeInfo(): void {
  logger.log('🚀 全自动部署模式已启用')
  logger.log('如需更精细的控制，您可以通过设置 interactive: true 来启用交互式部署模式')
  logger.divider()
}