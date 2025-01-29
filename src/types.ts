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
   * @example path.resolve(__dirname, '../dist.tar.gz')
   */
  zipPath: string

  /**
   * 远程服务器的压缩文件路径
   * @example '/home/nginx/html/dist.tar.gz'
   */
  remoteZipPath: string
  /**
   * 远程服务器的解压目录路径
   * ### 不可以和 remoteZipPath 目录相同
   * 因为 remoteUnzipDir 会先被删除再创建，他是你的项目目录
   * @example '/home/nginx/html/project'
   */
  remoteUnzipDir: string
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
