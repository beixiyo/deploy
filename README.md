# 一键快速部署项目到服务器


## 安装

```bash
npm i @jl-org/deploy
```


## 快速上手

```bash
touch scripts/deploy.cjs

node scripts/deploy.cjs
```

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
   * 执行打包命令后文件夹路径
   * @example path.resolve(__dirname, '../dist')
   */
  distPath: resolve(__dirname, '../dist'),
  /** 
   * 压缩打包文件夹（distPath）后的文件路径
   * @example path.resolve(__dirname, '../dist.tar.gz')
   */
  zipPath: resolve(__dirname, '../dist.tar.gz'),
  /**
   * 远程服务器的压缩文件路径
   * @example '/home/nginx/html/dist.tar.gz'
   */
  remoteZipPath: '/root/dist.tar.gz',
  /**
   * 远程服务器的解压目录路径
   * ### 不可以和 remoteZipPath 目录相同
   * 因为 remoteUnzipDir 会先被删除再创建，他是你的项目目录
   * @example '/home/nginx/html/project'
   */
  remoteUnzipDir: '/root/test-project',
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
}
```