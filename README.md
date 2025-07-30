# jl-deploy

一个基于 SSH 的自动化部署工具，支持多服务器部署、文件备份、交互式部署和自定义部署流程

## 特性

- 自动构建、压缩、上传和部署
- 支持多服务器并行部署
- **🤝 交互式部署模式**：在每个阶段询问用户确认，提供精细控制
- 支持远程文件备份和清理
- 友好的彩色日志输出
- 自定义上传和部署行为
- 可跳过构建步骤，提高部署效率

![demo](./docAssets/demo.webp)

## 安装

```bash
npm install jl-deploy
# 或
yarn add jl-deploy
# 或
pnpm add jl-deploy
```


## 基本用法

`scripts/deploy.cjs`
```js
// @ts-check
const { deploy } = require('@jl-org/deploy')
const { resolve } = require('node:path')
const { homedir } = require('node:os')
const { readFileSync } = require('node:fs')

deploy({
  // ======================
  // * SSH 连接信息
  // ======================
  connectInfos: [
    {
      name: 'server-1', // 服务器名称（可选，用于日志显示）
      host: '192.168.1.100',
      port: 22,
      username: 'root',
      password: 'password',
      // 如果使用私钥登录，不使用密码登录的话
      // privateKey: readFileSync(resolve(homedir(), '.ssh/id_rsa'), 'utf-8'),
    }
  ],
  
  // ======================
  // * 本地构建配置
  // ======================
  buildCmd: 'npm run build', // 构建命令
  distDir: resolve(__dirname, '../dist'), // 构建产物目录
  skipBuild: false, // 是否跳过构建步骤
  
  // 压缩文件配置
  zipPath: resolve(__dirname, '../dist.tar.gz'), // 本地压缩文件路径
  
  // ======================
  // * 远程服务器配置
  // ======================
  remoteZipPath: '/home/dist.tar.gz', // 远程压缩文件路径
  remoteUnzipDir: '/home/test-project', // 远程解压目录
  remoteCwd: '/', // 远程命令执行路径
  deployCmd: '', // 远程服务器部署命令，和 customDeploy 回调冲突
  
  // ======================
  // * 备份配置（可选）
  // ======================
  remoteBackupDir: '/home/test-project-backup', // 远程备份目录
  maxBackupCount: 5, // 保留最近的备份数量
  
  // ======================
  // * 其他选项
  // ======================
  needRemoveZip: true, // 是否需要删除本地压缩文件
  uploadRetryCount: 3, // 上传失败重试次数
  interactive: false // 禁用交互模式（默认）
})
```

启用交互模式后，系统将在每个阶段前询问：
- 🔨 **构建阶段**：是否执行构建命令
- 📦 **压缩阶段**：是否压缩构建产物
- 🚀 **上传和部署阶段**：是否上传并部署到服务器
- 🧹 **清理阶段**：是否清理本地临时文件

---

## 高级用法

### 自定义上传行为

```js
deploy({
  // ...基本配置
  
  // 自定义上传行为
  customUpload: async (createServer) => {
    const server = createServer()
    // 自定义连接和上传逻辑
    return [server]
  }
})
```

### 自定义部署行为

```js
deploy({
  // ...基本配置
  
  // 自定义部署行为
  customDeploy: async (servers, connectInfos) => {
    // 自定义解压和部署逻辑
    for (const server of servers) {
      // 执行自定义部署命令
    }
  }
})
```

### 服务器就绪回调

```js
deploy({
  // ...基本配置
  
  // 服务器连接成功回调
  onServerReady: async (server, connectInfo) => {
    // 服务器连接成功后，部署前的自定义操作
  }
})
```

## 配置选项

| 选项 | 类型 | 默认值 | 描述 |
| --- | --- | --- | --- |
| `connectInfos` | `ConnectInfo[]` | - | **必填**，SSH 连接信息数组 |
| `buildCmd` | `string` | `'npm run build'` | 构建命令 |
| `skipBuild` | `boolean` | `false` | 是否跳过构建步骤 |
| `interactive` | `boolean` | `false` | 是否启用交互式部署模式 |
| `deployCmd` | `string` | *见下方* | 远程服务器部署命令 |
| `distDir` | `string` | - | **必填**，构建产物目录路径 |
| `zipPath` | `string` | - | **必填**，压缩文件路径 |
| `remoteZipPath` | `string` | - | **必填**，远程压缩文件路径 |
| `remoteUnzipDir` | `string` | - | **必填**，远程解压目录路径 |
| `remoteBackupDir` | `string` | - | 远程备份目录路径 |
| `maxBackupCount` | `number` | `5` | 最大备份数量 |
| `remoteCwd` | `string` | `'/'` | 远程命令执行路径 |
| `needRemoveZip` | `boolean` | `true` | 是否删除本地压缩文件 |
| `uploadRetryCount` | `number` | `3` | 上传失败重试次数 |
| `onServerReady` | `function` | - | 服务器准备完毕回调 |
| `customUpload` | `function` | - | 自定义上传行为 |
| `customDeploy` | `function` | - | 自定义部署行为 |

**默认部署命令:**

```bash
cd ${remoteCwd} &&
rm -rf ${remoteUnzipDir} &&
mkdir -p ${remoteUnzipDir} &&
tar -xzf ${remoteZipPath} -C ${remoteUnzipDir} &&
rm -rf ${remoteZipPath} &&
exit
```

## 注意事项

1. `remoteUnzipDir` 不应与 `remoteZipPath` 的目录相同，因为部署过程中会先删除 `remoteUnzipDir` 目录
2. 使用自定义 `deployCmd` 时，命令末尾必须有换行符
3. `skipBuild` 为 true 时，会检查构建产物目录是否存在，不存在则报错
4. 在 CI/CD 环境中，使用 `interactive: false` 以避免阻塞
