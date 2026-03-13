import { toUnixPath } from './tool'
import type { DeployOpts, PartRequiredDeployOpts } from './types'


export function getOpts(opts: DeployOpts): PartRequiredDeployOpts {
  const remoteCwd = opts.remoteCwd ?? '/'
  /**
   * 使用 exec() 非交互模式执行，命令结束后 stream 自动关闭，无需 exit
   * - 进入服务器暂存地址
   * - 删除旧的部署目录
   * - 创建新的部署目录
   * - 解压上传的压缩包到部署目录
   * - 删除远程压缩包
   */
  const deployCmd = opts.deployCmd ?? [
    `cd ${toUnixPath(remoteCwd)}`,
    `sudo rm -rf ${toUnixPath(opts.remoteUnzipDir)}`,
    `mkdir -p ${toUnixPath(opts.remoteUnzipDir)}`,
    `tar -xzf ${toUnixPath(opts.remoteZipPath)} -C ${toUnixPath(opts.remoteUnzipDir)}`,
    `rm -rf ${toUnixPath(opts.remoteZipPath)}`,
  ].join(' && ')

  return {
    remoteCwd,
    buildCmd: 'npm run build',
    needRemoveZip: true,
    uploadRetryCount: 3,
    maxBackupCount: 5,
    skipBuild: false,
    interactive: false,
    concurrent: true,
    ...opts,
    deployCmd,
  }
}
