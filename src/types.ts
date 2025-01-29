import type { ConnectConfig } from 'ssh2'


export interface DeployOpts {
  /**
   * ssh 连接信息
   */
  connectInfos: (ConnectConfig & { name?: string })[]

  /**
   * 打包命令
   * @default 'npm run build'
   */
  buildCmd?: string
  /**
   * 远程服务器部署命令
   * @default
   * `
   *   cd ${remoteCwd} &&
   *   rm -rf ${remoteUnzipDir} &&
   *   mkdir -p ${remoteUnzipDir} &&
   *   tar -xzf ${remoteZipPath} -C ${remoteUnzipDir} &&
   *   rm -rf ${remoteZipPath} &&
   *   exit
   * `
   */
  deployCmd?: string

  /** 
   * 执行打包命令后文件夹路径
   * @example path.resolve(__dirname, '../dist')
   */
  distPath: string
  /** 
   * 压缩打包文件夹（distPath）后的文件路径
   * @example path.resolve(__dirname, '../dist.tar.zip')
   */
  zipPath: string

  /**
   * 远程服务器的压缩文件路径
   * @example '/home/nginx/html/dist.tar.zip'
   */
  remoteZipPath: string
  /**
   * 解压到远程服务器的目录
   * @example 'project/'
   */
  /**
   * 远程服务器的命令行执行路径
   * @default '/'
   * @example '/home/nginx/html'
   */
  remoteCwd?: string
}
