import kleur from 'kleur'

/**
 * 日志级别枚举
 */
export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

/**
 * 进度显示配置
 */
export interface ProgressConfig {
  /** 进度条前缀信息 */
  message: string
  /** 当前进度 */
  current: number
  /** 总进度 */
  total: number
  /** 前缀（如服务器名称） */
  prefix?: string
  /** 显示类型：'percentage' 显示百分比，'fraction' 显示分数，'auto' 自动判断 */
  displayType?: 'percentage' | 'fraction' | 'auto'
  /** 自定义进度文本，如果提供则忽略 displayType */
  customText?: string
  /** 是否在同一行更新（避免刷屏） */
  sameLine?: boolean
}

/**
 * 日志管理类
 * 提供彩色打印和不同日志级别的功能
 */
export class Logger {
  private prefix: string = ''

  /**
   * 构造函数
   * @param prefix 日志前缀，会在每条日志前添加 [prefix]
   */
  constructor(prefix?: string) {
    if (prefix) {
      this.prefix = `[${prefix}] `
    }
  }

  /**
   * 普通信息日志
   */
  info(message: string) {
    console.log(kleur.blue(`${this.prefix}${message}`))
  }

  /**
   * 成功信息日志
   */
  success(message: string) {
    console.log(kleur.green(`${this.prefix}${message}`))
  }

  /**
   * 警告信息日志
   */
  warning(message: string) {
    console.log(kleur.yellow(`${this.prefix}${message}`))
  }

  /**
   * 错误信息日志
   */
  error(message: string, error?: any) {
    console.error(kleur.red(`${this.prefix}${message}`))
    if (error) {
      console.error(kleur.red(error instanceof Error ? error.stack || error.message : error))
    }
  }

  /**
   * 调试信息日志，仅在 DEBUG 环境变量设置时显示
   */
  debug(message: string) {
    if (process.env.DEBUG) {
      console.log(kleur.gray(`${this.prefix}${message}`))
    }
  }

  /**
   * 带服务器名称的日志，用于多服务器部署场景
   * @param serverName 服务器名称或标识
   * @param message 日志消息
   * @param level 日志级别
   */
  serverLog(serverName: string, message: string, level: LogLevel = LogLevel.INFO) {
    const serverPrefix = serverName ? `[${serverName}] ` : ''

    switch (level) {
      case LogLevel.SUCCESS:
        console.log(kleur.green(`${this.prefix}${serverPrefix}${message}`))
        break
      case LogLevel.WARNING:
        console.log(kleur.yellow(`${this.prefix}${serverPrefix}${message}`))
        break
      case LogLevel.ERROR:
        console.error(kleur.red(`${this.prefix}${serverPrefix}${message}`))
        break
      case LogLevel.DEBUG:
        if (process.env.DEBUG) {
          console.log(kleur.gray(`${this.prefix}${serverPrefix}${message}`))
        }
        break
      default:
        console.log(kleur.blue(`${this.prefix}${serverPrefix}${message}`))
    }
  }

  /**
   * 显示进度条
   * @param config 进度配置
   */
  progress(config: ProgressConfig) {
    const {
      message,
      current,
      total,
      prefix,
      displayType = 'auto',
      customText,
      sameLine = true
    } = config

    const percent = Math.round((current / total) * 100)
    const progressBar = this.getProgressBar(percent)
    const prefixText = prefix ? `[${prefix}] ` : ''

    let progressText: string
    if (customText) {
      progressText = customText
    }
    else {
      switch (displayType) {
        case 'percentage':
          progressText = `${percent}%`
          break
        case 'fraction':
          progressText = `${current}/${total}`
          break
        case 'auto':
        default:
          // 如果是小数值(可能是文件数量)，显示 "x/y"，否则显示百分比
          progressText = total < 1000
            ? `${current}/${total}`
            : `${percent}%`
          break
      }
    }

    if (sameLine) {
      // 使用 \r 确保在同一行更新，不换行
      process.stdout.write(`\r${this.prefix}${prefixText}${message} ${progressBar} ${progressText}`)

      // 只有在完成时才换行
      if (current >= total) {
        process.stdout.write('\n')
      }
    }
    else {
      // 正常换行显示
      console.log(`${this.prefix}${prefixText}${message} ${progressBar} ${progressText}`)
    }
  }

  /**
   * 生成进度条字符串
   */
  private getProgressBar(percent: number): string {
    const width = 20
    const completed = Math.floor(width * percent / 100)
    const remaining = width - completed

    return kleur.green('█'.repeat(completed)) + kleur.gray('░'.repeat(remaining))
  }

  /**
   * 清除当前行并替换为新消息
   */
  clearLine(message: string) {
    process.stdout.write('\r\x1b[K') // 清除当前行
    process.stdout.write(message)
  }

  /**
   * 打印分隔线
   */
  divider() {
    console.log(kleur.dim('─'.repeat(50)))
  }

  /**
   * 打印空行
   */
  newLine() {
    console.log('')
  }

  /**
   * 打印标题
   */
  title(message: string) {
    this.newLine()
    console.log(kleur.bold().white().bgBlue(` ${message} `))
    this.divider()
  }

  /**
   * 打印普通文本（白色太单调，改用青色）
   */
  log(message: string) {
    console.log(kleur.cyan(`${this.prefix}${message}`))
  }

  /**
   * 打印表格形式的数据
   */
  table(data: Record<string, string>) {
    const maxKeyLength = Math.max(...Object.keys(data).map(k => k.length))

    this.newLine()
    Object.entries(data).forEach(([key, value]) => {
      const paddedKey = key.padEnd(maxKeyLength)
      console.log(`${kleur.dim(this.prefix)}${kleur.bold().cyan(paddedKey)} ${kleur.dim('│')} ${value}`)
    })
    this.newLine()
  }

  /**
   * 打印部署阶段开始
   */
  stage(name: string) {
    this.newLine()
    console.log(kleur.magenta().bold(`${this.prefix}▶ ${name}`))
  }
}

// 导出默认实例
export const logger = new Logger('Deploy')