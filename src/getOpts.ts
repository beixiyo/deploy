import type { DeployOpts } from './types'


export function getOpts(opts: DeployOpts): Required<DeployOpts> {
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
    ...opts,
    deployCmd,
    remoteCwd,
    buildCmd: 'npm run build',
  }
}

/**
 * 把路径转成类似 unix 风格的路径
 */
function toUnixPath(path: string): string {
  return path.replace(/\\/g, '/')
}
