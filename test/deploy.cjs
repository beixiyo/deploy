// @ts-check
const { deploy } = require('@jl-org/deploy')
const { resolve } = require('node:path')
const { getEnv, getSSHKey } = require('./tools.cjs')
const loadEnv = require('./loadEnv.cjs')
loadEnv()

/**
 * 使用说明:
 *
 * 1. 设置环境变量:
 *    - SSH_HOST: 服务器地址 (必需)
 *    - SSH_PORT: SSH端口 (默认: 22)
 *    - SSH_USER: 用户名 (默认: root)
 *    - SSH_PRIVATE_KEY: SSH私钥内容
 *    - SSH_KEY_PATH: SSH私钥文件路径
 *
 * 2. 部署命令:
 *    开发环境: node deploy.cjs dev
 *    生产环境: node deploy.cjs production
 *
 * 3. 其他环境变量:
 *    - BUILD_CMD: 构建命令 (默认: pnpm build)
 *    - REMOTE_ZIP_PATH: 远程压缩包路径
 *    - REMOTE_UNZIP_DIR: 远程解压目录
 *    - SKIP_BUILD: 是否跳过构建 (true/false)
 *    - REMOTE_CWD: 远程工作目录
 *    - REMOTE_BACKUP_DIR: 远程备份目录
 *    - MAX_BACKUP_COUNT: 最大备份数量
 *    - NEED_REMOVE_ZIP: 是否需要删除本地压缩文件
 *    - UPLOAD_RETRY_COUNT: 上传重试次数
 */

/**
 * @type {import('@jl-org/deploy').ConnectInfo[]}
 */
const connectInfos = [
  {
    host: getEnv('SSH_HOST', '', true),
    port: Number(getEnv('SSH_PORT', '22')),
    username: getEnv('SSH_USER', 'root'),
    privateKey: getSSHKey(),
    name: getEnv('SERVER_NAME', '测试服务器'),
  },
]

/**
 * 命令执行的模式
 * @example node deploy.cjs dev
 */
const mode = process.argv.slice(2)[0] || 'dev'

/**
 * @type {Record<string, Omit<import('@jl-org/deploy').DeployOpts, 'connectInfos'>>}
 */
const config = {
  dev: {
    buildCmd: getEnv('BUILD_CMD', 'pnpm build'),
    distDir: resolve(__dirname, './dist'),
    zipPath: resolve(__dirname, '../dist.tar.gz'),
    remoteZipPath: getEnv('REMOTE_ZIP_PATH', '/home/test-deploy/dist.tar.gz'),
    remoteUnzipDir: getEnv('REMOTE_UNZIP_DIR', '/home/test-deploy/project'),

    // ======================
    // * 可选配置
    // ======================
    concurrent: true,
    interactive: false,
    skipBuild: getEnv('SKIP_BUILD', 'true') === 'true',
    remoteCwd: getEnv('REMOTE_CWD', '/'),
    remoteBackupDir: getEnv('REMOTE_BACKUP_DIR', '/home/test-deploy/project-backup'),
    maxBackupCount: Number(getEnv('MAX_BACKUP_COUNT', '3')),
    needRemoveZip: getEnv('NEED_REMOVE_ZIP', 'true') === 'true',
    uploadRetryCount: Number(getEnv('UPLOAD_RETRY_COUNT', '3')),

    // ======================
    // * 测试自定义部署命令
    // 如果需要使用自定义部署命令，取消下面的注释
    // ======================
    // deployCmd: `echo "自定义部署命令" > /home/test-deploy/deployCmd.txt && exit
    // `,

    // ======================
    // * 测试服务器就绪回调
    // ======================
    // async onServerReady(server, connectInfo) {
    //   console.log(`==================== 服务器 ${connectInfo.name} 已就绪，执行前置操作`)
    //   // 这里可以执行一些服务器连接成功后的操作
    // },

    // ======================
    // * 测试自定义上传逻辑
    // 如果需要使用自定义上传，取消下面的注释
    // ======================
    // async customUpload(createServer, connectInfos) {
    //   console.log('====================> 开始执行自定义上传')
    //   const server = createServer()

    //   return new Promise((resolve) => {
    //     server.on('ready', () => {
    //       console.log('====================> 自定义连接成功')
    //       // 执行自定义上传逻辑
    //       resolve([server])
    //     })
    //     server.connect(connectInfos[0])
    //   })
    // },

    // ======================
    // * 测试自定义部署逻辑
    // 如果需要使用自定义部署，取消下面的注释
    // ======================
    // async customDeploy(servers, serverInfos) {
    //   console.log('====================> 开始执行自定义部署')

    //   return new Promise((resolve) => {
    //     console.log(`主机地址: ${serverInfos[0].host}`)
    //     servers[0].exec('echo "自定义部署完成" > /home/test-deploy/customDeploy.txt', () => {
    //       console.log('自定义部署完成')
    //       resolve()
    //     })
    //   })
    // }

    // ======================
    // * Hooks
    // ======================
    // // 构建阶段 hooks
    // onBeforeBuild: async (context) => {
    //   console.log('====================> onBeforeBuild 准备开始构建...', context.buildCmd)
    // },
    // onAfterBuild: async (context) => {
    //   console.log('====================> onAfterBuild 构建完成！')
    // },

    // // 压缩阶段 hooks
    // onBeforeCompress: async (context) => {
    //   console.log('====================> onBeforeCompress 开始压缩文件...', context.distDir)
    // },
    // onAfterCompress: async (context) => {
    //   console.log('====================> onAfterCompress 压缩完成！', context.zipPath)
    // },

    // // 连接阶段 hooks
    // onBeforeConnect: async (context) => {
    //   console.log('====================> onBeforeConnect 准备连接服务器...', context.connectInfos.length)
    // },
    // onAfterConnect: async (context) => {
    //   console.log('====================> onAfterConnect 服务器连接成功！')
    // },

    // // 上传阶段 hooks（每个服务器单独触发）
    // onBeforeUpload: async (context) => {
    //   console.log('====================> onBeforeUpload 开始上传到:', context.connectInfo?.host || '未知服务器')
    // },
    // onAfterUpload: async (context) => {
    //   console.log('====================> onAfterUpload 上传成功:', context.connectInfo?.host || '未知服务器')
    // },

    // // 部署阶段 hooks
    // onBeforeDeploy: async (context) => {
    //   console.log('====================> onBeforeDeploy 开始部署...', context.sshClients.length)
    // },
    // onAfterDeploy: async (context) => {
    //   console.log('====================> onAfterDeploy 部署完成！')
    // },

    // // 清理阶段 hooks
    // onBeforeCleanup: async (context) => {
    //   console.log('====================> onBeforeCleanup 准备清理临时文件...', context.zipPath)
    // },
    // onAfterCleanup: async (context) => {
    //   console.log('====================> onAfterCleanup 清理完成！')
    // },

    // // 全局错误处理 hook
    // onError: async (context) => {
    //   console.error('====================> onError 部署出错:', context.error.code, context.error.message)

    //   // 返回 true 表示错误已处理，继续执行；返回 false 或不返回表示重新抛出错误
    //   return false
    // }
  }
}

if (!config[mode]) {
  console.error(`错误: 未知的部署模式 '${mode}'，支持的模式: ${Object.keys(config).join(', ')}`)
  process.exit(1)
}

console.log(`开始执行 ${mode} 环境部署流程`)
const curConfig = config[mode]

/**
 * 执行部署
 */
deploy({
  ...curConfig,
  connectInfos,
})
  .catch(err => {
    console.error('部署过程中发生错误:', err)
    process.exit(1)
  })

