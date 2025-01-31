// @ts-check
const { deploy } = require('@jl-org/deploy')
const { resolve } = require('node:path')
const { homedir } = require('node:os')
const { readFileSync } = require('node:fs')

const privateKey = readFileSync(resolve(homedir(), '.ssh/id_rsa'), 'utf-8')
const connectInfos = [
  {
    host: 'yourHost',
    username: 'root',
    privateKey,
    name: '服务器名称，可选项',
  },
]

/** 
 * 命令执行的模式
 * @example node deploy.cjs dev
 */
const mode = process.argv.slice(2)[0] || 'dev'

/**
 * @type {Record<'dev' | 'production', Omit<import('@jl-org/deploy').DeployOpts, 'connectInfos'>>}
 */
const config = {
  dev: {
    buildCmd: 'pnpm build',
    distPath: resolve(__dirname, '../dist'),
    zipPath: resolve(__dirname, '../dist.tar.gz'),
    remoteZipPath: '/root/dist.tar.gz',
    remoteUnzipDir: '/root/test-project',

    // deployCmd: `cd / &&
    // rm -rf /root/test-project &&
    // mkdir -p /root/test-project &&
    // tar -xzf /root/dist.tar.gz -C /root/test-project &&
    // rm -rf /root/dist.tar.gz &&
    // exit
    // `,

    // deployCmd: `rm -rf /root/test-project && exit
    // `,

    // async customDeploy(servers) {
    //   console.log('开始执行 customDeploy 命令')
    //   return new Promise((resolve, reject) => {
    //     servers[0].exec(`echo "test customDeploy" > /root/customDeploy.txt`, () => { resolve() })
    //   })
    // },
    // async customUpload(createServer) {
    //   const server = createServer()
    //   const serverArr = [server]
    //   return new Promise((resolve, reject) => {
    //     server.on('ready', () => {
    //       server.exec(`echo "test customUpload" > /root/customUpload.txt`, () => {
    //         resolve(serverArr)
    //       })
    //     })

    //     server.connect(connectInfos[0])
    //   })
    // }
  },
  production: {
    buildCmd: 'pnpm build',
    distPath: resolve(__dirname, '../dist'),
    zipPath: resolve(__dirname, '../dist.tar.gz'),
    remoteZipPath: '/root/dist.tar.gz',
    remoteUnzipDir: '/root/prod-project',
  }
}

const curConfig = config[mode]
deploy({
  ...curConfig,
  connectInfos,
})