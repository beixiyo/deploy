import type { Client, ConnectConfig } from 'ssh2'


export interface DeployOpts {
  /**
   * ssh 连接信息
   */
  connectInfos: ConnectInfo[]

  /**
   * 打包命令
   * @default 'npm run build'
   */
  buildCmd?: string
  /**
   * 远程服务器部署命令
   * ### 注意：传递此参数，末尾必须有回车，否则无法执行。此 bug 问题在于 ssh2
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
   * 执行打包命令后的打包文件夹路径
   * @example path.resolve(__dirname, '../dist')
   */
  distDir: string
  /**
   * 压缩打包文件夹（distDir）后的文件路径
   * @example path.resolve(__dirname, '../dist.tar.gz')
   */
  zipPath: string

  /**
   * 上传到远程服务器的压缩文件路径
   * @example '/home/nginx/dist.tar.gz'
   */
  remoteZipPath: string
  /**
   * 远程服务器的解压目录路径
   * ### 不可以和 remoteZipPath 目录相同
   * 因为 remoteUnzipDir 会先被删除再创建，remoteUnzipDir 是你的项目目录
   * @example '/home/nginx/html/project'
   */
  remoteUnzipDir: string

  /**
   * 远程服务器备份目录，用于备份当前压缩包。
   * 不设置则不备份
   */
  remoteBackupDir?: string

  /**
   * 最大备份数量
   * 如果配置了 remoteBackupDir，并且备份目录中的压缩包数量超过了此值，则会删除最早的备份
   * @default 5
   */
  maxBackupCount?: number

  /**
   * 远程服务器的命令行执行路径
   * @default '/'
   * @example '/home/nginx/html'
   */
  remoteCwd?: string

  /**
   * 是否需要删除远程服务器的压缩文件
   * @default true
   */
  needRemoveZip?: boolean

  /**
   * 上传失败重试次数
   * @default 3
   */
  uploadRetryCount?: number

  /**
   * 服务器准备完毕的回调，调用次数和 connectInfos 长度相同
   */
  onServerReady?: (server: Client, connectInfo: ConnectInfo) => Promise<void>
  /**
   * 自定义上传行为，如果传递了该函数，则会覆盖默认上传行为
   * @param createServer 一个函数，用于创建 ssh2.Client 对象
   * @returns 返回一个数组，数组中的元素是 ssh2.Client 对象
   */
  customUpload?: (createServer: () => Client) => Promise<Client[]>
  /**
   * 自定义部署行为，如果传递了该函数，则会覆盖默认部署行为，deployCmd 参数不会生效
   */
  customDeploy?: (servers: Client[], connectInfos: ConnectInfo[]) => Promise<void>
}

export type ConnectInfo = (ConnectConfig & { name?: string })