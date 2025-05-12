import { toUnixPath } from './tool'
import type { DeployOpts } from './types'


export function getOpts(opts: DeployOpts): Required<
  Omit<
    DeployOpts,
    | 'onServerReady'
    | 'customUpload'
    | 'customDeploy'
    | 'remoteBackupPath'
    | 'maxBackupCount'
  >
> {
  const remoteCwd = opts.remoteCwd ?? '/'
  /**
   * - 进入服务器暂存地址
   * - 解压上传的压缩包
   * - 移动解压后的文件到发布目录
   * - 删除压缩包
   * - 退出
   */
  const deployCmd = opts.deployCmd ?? `
    cd ${toUnixPath(remoteCwd)} &&
    rm -rf ${toUnixPath(opts.remoteUnzipDir)} &&
    mkdir -p ${toUnixPath(opts.remoteUnzipDir)} &&
    tar -xzf ${toUnixPath(opts.remoteZipPath)} -C ${toUnixPath(opts.remoteUnzipDir)} &&
    rm -rf ${toUnixPath(opts.remoteZipPath)} &&
    exit
  `

  return {
    deployCmd,
    remoteCwd,
    buildCmd: 'npm run build',
    needRemoveZip: true,
    uploadRetryCount: 3,
    maxBackupCount: 5,
    ...opts,
  }
}
