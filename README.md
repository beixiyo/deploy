# 一键快速部署项目到服务器


## 安装

```bash
npm i @jl-org/deploy -D
```


## 快速上手

```bash
touch scripts/deploy.cjs

node scripts/deploy.cjs
```

`scripts/deploy.cjs`
```js
// @ts-check
const { deploy } = require('@jl-org/deploy')
const { resolve } = require('node:path')
const { homedir } = require('node:os')
const { readFileSync } = require('node:fs')


deploy({
  /**
   * ssh 连接信息
   */
  connectInfos: [
    {
      host: 'Your Host',
      username: 'Your Username',
      name: '服务器名称，可选项',
      password: 'Your Password',
      // 如果使用私钥登录，不使用密码登录的话
      // privateKey: readFileSync(resolve(homedir(), '.ssh/id_rsa'), 'utf-8'),
    },
  ],

  /**
   * 打包命令
   * @default 'npm run build'
   */
  buildCmd: 'npm run build',

  /** 
   * 执行打包命令后的打包文件夹路径
   * @example path.resolve(__dirname, '../dist')
   */
  distPath: resolve(__dirname, '../dist'),
  /** 
   * 压缩打包文件夹（distPath）后的文件路径
   * @example path.resolve(__dirname, '../dist.tar.gz')
   */
  zipPath: resolve(__dirname, '../dist.tar.gz'),
  /**
   * 上传到远程服务器的压缩文件路径
   * @example '/home/nginx/dist.tar.gz'
   */
  remoteZipPath: '/home/dist.tar.gz',
  /**
   * 远程服务器的解压目录路径
   * ### 不可以和 remoteZipPath 目录相同
   * 因为 remoteUnzipDir 会先被删除再创建，remoteUnzipDir 是你的项目目录
   * @example '/home/nginx/html/project'
   */
  remoteUnzipDir: '/home/test-project',
})
```


## 自定义配置

下面的配置是可选项，可以改变默认行为

```ts
export interface DeployOpts {

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
   * 远程服务器的命令行执行路径
   * @default '/'
   * @example '/home/nginx/html'
   */
  remoteCwd?: string

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
```

---


## 根据环境执行不同命令

`package.json`
```json
{
  "scripts": {
    "deploy-dev": "node scripts/deploy.cjs dev",
    "deploy-prod": "node scripts/deploy.cjs production"
  }
}
```

`scripts/deploy.cjs`
```js
// @ts-check
const { deploy } = require('@jl-org/deploy')
const { resolve } = require('node:path')
const { homedir } = require('node:os')
const { readFileSync } = require('node:fs')

const privateKey = readFileSync(resolve(homedir(), '.ssh/id_rsa'), 'utf-8')

/** 
 * 命令执行的模式
 * @example node scripts/deploy.cjs dev
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
    remoteZipPath: '/home/dist.tar.gz',
    remoteUnzipDir: '/home/test-project',
  },
  production: {
    buildCmd: 'pnpm build',
    distPath: resolve(__dirname, '../dist'),
    zipPath: resolve(__dirname, '../dist.tar.gz'),
    remoteZipPath: '/home/dist.tar.gz',
    remoteUnzipDir: '/home/prod-project',
  }
}

const curConfig = config[mode]
deploy({
  ...curConfig,
  connectInfos: [
    {
      host: 'Your Host',
      username: 'Your Username',
      privateKey,
      name: '服务器名称，可选项',
    },
  ],
})
```