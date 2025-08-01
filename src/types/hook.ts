import type { Client } from 'ssh2'
import type { ConnectInfo, PartRequiredDeployOpts } from './deploy'
import type { DeployError } from './error'


/**
 * 部署阶段枚举
 */
export type DeployStage =
  | 'validation'
  | 'build'
  | 'compress'
  | 'connect'
  | 'upload'
  | 'deploy'
  | 'cleanup'
  | 'unknown'

/**
 * Hook 上下文信息
 */
export interface HookContext {
  /** 当前配置 */
  opts: PartRequiredDeployOpts
  /** 当前阶段名称 */
  stage: DeployStage
  /** 开始时间 */
  startTime: number
  /** 当前服务器信息（如果适用） */
  connectInfo?: ConnectInfo
  /** 服务器索引（如果适用） */
  serverIndex?: number
}

/**
 * 构建 Hook 上下文
 */
export interface BuildHookContext extends HookContext {
  /** 构建命令 */
  buildCmd: string
  /** 是否跳过构建 */
  skipBuild: boolean
}

/**
 * 压缩 Hook 上下文
 */
export interface CompressHookContext extends HookContext {
  /** 源目录 */
  distDir: string
  /** 压缩文件路径 */
  zipPath: string
}

/**
 * 连接 Hook 上下文
 */
export interface ConnectHookContext extends HookContext {
  /** 所有连接信息 */
  connectInfos: ConnectInfo[]
  /** 并发模式 */
  concurrent: boolean
}

/**
 * 上传 Hook 上下文
 */
export interface UploadHookContext extends HookContext {
  /** 上传的文件路径 */
  zipPath: string
  /** 远程文件路径 */
  remoteZipPath: string
  /** SSH 客户端（onAfterUpload 时可用） */
  sshClient?: Client
}

/**
 * 部署 Hook 上下文
 */
export interface DeployHookContext extends HookContext {
  /** 部署命令 */
  deployCmd: string
  /** SSH 客户端数组 */
  sshClients: Client[]
}

/**
 * 清理 Hook 上下文
 */
export interface CleanupHookContext extends HookContext {
  /** 要清理的文件路径 */
  zipPath: string
  /** 是否需要删除 */
  needRemoveZip: boolean
}

/**
 * 错误 Hook 上下文
 */
export interface ErrorHookContext extends HookContext {
  /** 错误信息 */
  error: DeployError
  /** 是否可以重试 */
  canRetry: boolean
  /** 当前重试次数 */
  retryCount?: number
}
