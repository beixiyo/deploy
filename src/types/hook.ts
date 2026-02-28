import type { Client, SFTPWrapper } from 'ssh2'
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
 * 远程命令执行结果
 */
export interface ShellExecResult {
  /** 标准输出 */
  stdout: string
  /** 标准错误输出 */
  stderr: string
  /** 退出码 */
  code: number | null
  /** 退出信号 */
  signal: string | null
}

/**
 * 远程 Shell 执行参数
 */
export interface RemoteShellOptions {
  /** 目标服务器索引，不传则用 context.serverIndex 或 0 */
  serverIndex?: number
  /** 远程工作目录，不传则用 opts.remoteCwd 或 '/' */
  cwd?: string
}

/**
 * Hook 中可用的远程 Shell 工具
 */
export interface HookShell {
  /**
   * 一次性在远程服务器执行命令，收集完整输出
   */
  exec: (cmd: string, options?: RemoteShellOptions) => Promise<ShellExecResult>

  /**
   * 流式执行远程命令，实时输出 stdout/stderr 到日志，结束后返回完整结果
   */
  spawn: (cmd: string, options?: RemoteShellOptions) => Promise<ShellExecResult>

  /**
   * 在远程服务器上执行 SFTP 操作，传入的 task 将收到 SFTPWrapper 实例，
   * 可调用 fastPut、fastGet、readdir、mkdir、stat 等 ssh2 SFTP API
   */
  sftp: <T>(task: (sftp: SFTPWrapper) => Promise<T>, options?: RemoteShellOptions) => Promise<T>
}

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
  /** 远程 Shell 执行工具 */
  shell: HookShell
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
