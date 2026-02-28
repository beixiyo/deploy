// @ts-check
const { deploy } = require('@jl-org/deploy')
const { resolve } = require('node:path')
const { homedir } = require('node:os')
const { readFileSync } = require('node:fs')

const timestamp = Date.now().toString()
const privateKey = readFileSync(resolve(homedir(), '.ssh/id_rsa'), 'utf-8')

/**
 * @type {import('@jl-org/deploy').ConnectInfo[]}
  */
const connectInfos = [
  {
    host: 'yourHost',
    username: 'root',
    privateKey,
    name: '服务器名称，可选项',
  },
]

/**
 * @typedef {'dev' | 'production'} Mode
*/

/**
 * 命令执行的模式
 * @example node deploy.cjs dev
 * @type {Mode}
  */
const mode = /** @type {Mode} * / (process.argv.slice(2)[0] || 'dev')

/**
 * @type {Record<Mode, Omit<import('@jl-org/deploy').DeployOpts, 'connectInfos'>>}
  */
const config = {
  dev: {
    buildCmd: 'pnpm build',
    distDir: resolve(__dirname, '../dist'),
    zipPath: resolve(__dirname, '../dist.tar.gz'),
    remoteZipPath: '/home/dist.tar.gz',
    remoteUnzipDir: '/home/test-project',


    /***************************************************
     *                  自定义可选配置
     ***************************************************/

    // deployCmd: `cd / &&
    // rm -rf /home/test-project &&
    // mkdir -p /home/test-project &&
    // tar -xzf /home/dist.tar.gz -C /home/test-project &&
    // rm -rf /home/dist.tar.gz &&
    // exit
    // `,

    // deployCmd: `rm -rf /home/test-project && exit
    // `,

    // async customDeploy(servers) {
    //   console.log('开始执行 customDeploy 命令')
    //   return new Promise((resolve, reject) => {
    //     servers[0].exec(`echo "test customDeploy" > /home/customDeploy.txt`, () => { resolve() })
    //   })
    // },
    // async customUpload(createServer) {
    //   const server = createServer()
    //   const serverArr = [server]
    //   return new Promise((resolve, reject) => {
    //     server.on('ready', () => {
    //       server.exec(`echo "test customUpload" > /home/customUpload.txt`, () => {
    //         resolve(serverArr)
    //       })
    //     })

    //     server.connect(connectInfos[0])
    //   })
    // },

    onAfterDeploy: async (context) => {
      console.log('====================> onAfterDeploy 部署完成！')
      const { shell } = context
      const [execResult, spawnResult] = await Promise.all([
        shell.exec('echo "部署完成" > /home/dc/workspace/exec.txt'),
        shell.spawn('echo "部署完成" > /home/dc/workspace/spawn.txt')
      ])

      console.log('execResult', execResult)
      console.log('spawnResult', spawnResult)

      await shell.sftp(async (sftp) => {
        const remotePath = '/home/dc/workspace/package.json'
        await new Promise((res, rej) => {
          sftp.fastPut(resolve(__dirname, '../package.json'), remotePath, (err) => {
            if (err) {
              console.error('====================> sftp 上传失败:', err)
              rej(err)
              return
            }
            console.log('====================> sftp 上传成功')
            res('success')
          })
        })
      })
    },
  },
  production: {
    buildCmd: 'pnpm build',
    distDir: resolve(__dirname, '../dist'),
    zipPath: resolve(__dirname, '../dist.tar.gz'),
    remoteZipPath: `/home/${timestamp}-dist.tar.gz`,
    remoteUnzipDir: '/home/prod-project',
  }
}

const curConfig = config[mode]
if (curConfig) {
  deploy({
    ...curConfig,
    connectInfos,
  })
}
else {
  console.error(`错误: 未知的部署模式 '${mode}'，支持的模式: ${Object.keys(config).join(', ')}`)
  process.exit(1)
}