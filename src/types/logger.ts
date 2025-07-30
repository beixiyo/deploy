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