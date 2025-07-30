/**
 * 部署错误类型
 */
export class DeployError extends Error {
  public readonly code: DeployErrorCode
  public readonly details?: any
  public readonly serverName?: string

  constructor(
    code: DeployErrorCode,
    message: string,
    details?: any,
    serverName?: string
  ) {
    super(message)
    this.name = 'DeployError'
    this.code = code
    this.details = details
    this.serverName = serverName
  }

  toString(): string {
    const serverInfo = this.serverName ? `[${this.serverName}] ` : ''
    return `${this.name}(${this.code}): ${serverInfo}${this.message}`
  }
}

/**
 * 部署错误码枚举
 */
export enum DeployErrorCode {
  // 配置相关错误
  CONFIG_VALIDATION_FAILED = 'CONFIG_VALIDATION_FAILED',
  CONFIG_MISSING_REQUIRED = 'CONFIG_MISSING_REQUIRED',
  CONFIG_INVALID_PATH = 'CONFIG_INVALID_PATH',

  // 构建相关错误
  BUILD_COMMAND_FAILED = 'BUILD_COMMAND_FAILED',
  BUILD_DIST_NOT_FOUND = 'BUILD_DIST_NOT_FOUND',

  // 压缩相关错误
  COMPRESS_SOURCE_NOT_FOUND = 'COMPRESS_SOURCE_NOT_FOUND',
  COMPRESS_CREATE_DIR_FAILED = 'COMPRESS_CREATE_DIR_FAILED',
  COMPRESS_ARCHIVE_FAILED = 'COMPRESS_ARCHIVE_FAILED',
  COMPRESS_WRITE_FAILED = 'COMPRESS_WRITE_FAILED',

  // 连接相关错误
  CONNECT_SSH_FAILED = 'CONNECT_SSH_FAILED',
  CONNECT_SFTP_FAILED = 'CONNECT_SFTP_FAILED',
  CONNECT_AUTH_FAILED = 'CONNECT_AUTH_FAILED',
  CONNECT_TIMEOUT = 'CONNECT_TIMEOUT',

  // 上传相关错误
  UPLOAD_SFTP_FAILED = 'UPLOAD_SFTP_FAILED',
  UPLOAD_REMOTE_DIR_FAILED = 'UPLOAD_REMOTE_DIR_FAILED',
  UPLOAD_FILE_FAILED = 'UPLOAD_FILE_FAILED',
  UPLOAD_RETRY_EXHAUSTED = 'UPLOAD_RETRY_EXHAUSTED',

  // 部署相关错误
  DEPLOY_COMMAND_FAILED = 'DEPLOY_COMMAND_FAILED',
  DEPLOY_SHELL_FAILED = 'DEPLOY_SHELL_FAILED',
  DEPLOY_UNZIP_FAILED = 'DEPLOY_UNZIP_FAILED',

  // 备份相关错误
  BACKUP_UPLOAD_FAILED = 'BACKUP_UPLOAD_FAILED',
  BACKUP_CLEANUP_FAILED = 'BACKUP_CLEANUP_FAILED',
  BACKUP_CREATE_DIR_FAILED = 'BACKUP_CREATE_DIR_FAILED',

  // 清理相关错误
  CLEANUP_LOCAL_FILE_FAILED = 'CLEANUP_LOCAL_FILE_FAILED',
  CLEANUP_REMOTE_FILE_FAILED = 'CLEANUP_REMOTE_FILE_FAILED',

  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  USER_CANCELLED = 'USER_CANCELLED',
  NETWORK_ERROR = 'NETWORK_ERROR'
}
