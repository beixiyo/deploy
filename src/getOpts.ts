import type { DeployOpts } from './types'
import { join } from 'node:path'


export function getOpts(opts: DeployOpts): Required<DeployOpts> {
  const remoteUnzipDir = join(opts.remoteZipPath, '..')
  /**
   * - 进入服务器暂存地址
   * - 解压上传的压缩包
   * - 移动解压后的文件到发布目录
   * - 删除压缩包
   * - 退出
   */
  const deployCmd = `
    cd ${opts.remoteCwd} &&
    rm -rf ${remoteUnzipDir} &&
    mkdir -p ${remoteUnzipDir} &&
    tar -xzf ${opts.remoteZipPath} -C ${remoteUnzipDir} &&
    rm -rf ${opts.remoteZipPath} &&
    exit
  `

  return {
    ...opts,
    deployCmd,
    remoteCwd: '/',
    buildCmd: 'npm run build',
  }
}