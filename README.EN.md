# 🚀 Deploy

An SSH-based automated deployment tool that supports multi-server deployment, file backup, interactive deployment, and custom deployment workflows.

<p align="center">
  <a href="./README.EN.md">English</a>
  <a href="./README.md">中文</a>
</p>

<p align="center">
  <img alt="npm-version" src="https://img.shields.io/npm/v/@jl-org/deploy?color=red&logo=npm" />
  <img alt="npm-download" src="https://img.shields.io/npm/dy/@jl-org/deploy?logo=npm" />
  <img alt="License" src="https://img.shields.io/npm/l/@jl-org/deploy?color=blue" />
  <img alt="typescript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
  <img alt="github" src="https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white" />
</p>

## ✨ Features

- 🔨 Automatic build, compress, upload and deploy
- 🌐 Support for multi-server parallel deployment
- **🤝 Interactive deployment mode**: Ask for user confirmation at each stage for fine-grained control
- 💾 Support for remote file backup and cleanup
- 🎨 Friendly colored log output
- ⚙️ Customizable upload and deployment behavior
- ⚡ Skip build step to improve deployment efficiency
- **🎣 Rich lifecycle hooks**: Execute custom logic before and after each deployment stage
- **⚠️ Structured error handling**: Unified error codes and error types for easy CI/CD integration

![demo](./docAssets/demo.webp)

---

## 📦 Installation

```bash
npm install @jl-org/deploy
# or
yarn add @jl-org/deploy
# or
pnpm add @jl-org/deploy
```

---

## 🚀 Basic Usage

[Code Example](./example/test.cjs)

`scripts/deploy.cjs`
```js
// @ts-check
const { deploy } = require('@jl-org/deploy')
const { resolve } = require('node:path')
const { homedir } = require('node:os')
const { readFileSync } = require('node:fs')

deploy({
  // ======================
  // 🔗 SSH Connection Info
  // ======================
  connectInfos: [
    {
      name: 'server-1', // Server name (optional, used for log display)
      host: '192.168.1.100',
      port: 22,
      username: 'root',
      password: 'password',
      // If using private key login instead of password
      // privateKey: readFileSync(resolve(homedir(), '.ssh/id_rsa'), 'utf-8'),
    }
  ],
  
  // ======================
  // 🔨 Local Build Config
  // ======================
  buildCmd: 'npm run build', // Build command
  distDir: resolve(__dirname, '../dist'), // Build output directory
  skipBuild: false, // Whether to skip build step
  
  // 📦 Archive file configuration
  zipPath: resolve(__dirname, '../dist.tar.gz'), // Local archive file path
  
  // ======================
  // 🌐 Remote Server Config
  // ======================
  remoteZipPath: '/home/dist.tar.gz', // Remote archive file path
  remoteUnzipDir: '/home/test-project', // Remote extraction directory
  remoteCwd: '/', // Remote command execution path
  deployCmd: '', // (Optional) Remote server deployment command, conflicts with customDeploy callback. It is recommended not to change the default value
  
  // ======================
  // 💾 Backup Config (Optional)
  // ======================
  remoteBackupDir: '/home/test-project-backup', // Remote backup directory
  maxBackupCount: 5, // Keep recent backup count
  
  // ======================
  // ⚙️ Other Options
  // ======================
  needRemoveZip: true, // Whether to remove local archive file
  uploadRetryCount: 3, // Upload failure retry count
  interactive: false, // Disable interactive mode (default)
  concurrent: true // Concurrent deployment (default)
})
```

### 🤝 Interactive Deployment Mode

When interactive mode is enabled, the system will ask at each stage:
- 🔨 **Build Stage**: Whether to execute build command
- 📦 **Compress Stage**: Whether to compress build output
- 🚀 **Upload and Deploy Stage**: Whether to upload and deploy to server
- 🧹 **Cleanup Stage**: Whether to cleanup local temporary files

---

## 🎯 Advanced Usage

### 📤 Custom Upload Behavior

```js
deploy({
  // ...basic config
  
  // Custom upload behavior
  customUpload: async (createServer) => {
    const server = createServer()
    // Custom connection and upload logic
    return [server]
  }
})
```

### 🎛️ Custom Deploy Behavior

```js
deploy({
  // ...basic config
  
  // Custom deploy behavior
  customDeploy: async (servers, connectInfos) => {
    // Custom extraction and deployment logic
    for (const server of servers) {
      // Execute custom deployment commands
    }
  }
})
```

### 🔧 Server Ready Callback

```js
deploy({
  // ...basic config
  
  // Server connection success callback
  onServerReady: async (server, connectInfo) => {
    // Custom operations after server connection success, before deployment
  }
})
```

### 🎣 Lifecycle Hooks

```js
deploy({
  // ...basic config
  
  // 🔨 Build stage hooks
  onBeforeBuild: async (context) => {
    console.log('Preparing to build...', context.buildCmd)
  },
  onAfterBuild: async (context) => {
    console.log('Build completed!')
  },
  
  // 📦 Compress stage hooks
  onBeforeCompress: async (context) => {
    console.log('Starting to compress files...', context.distDir)
  },
  onAfterCompress: async (context) => {
    console.log('Compression completed!', context.zipPath)
  },
  
  // 🔗 Connection stage hooks
  onBeforeConnect: async (context) => {
    console.log('Preparing to connect to servers...', context.connectInfos.length)
  },
  onAfterConnect: async (context) => {
    console.log('Server connection successful!')
  },
  
  // 📤 Upload stage hooks (triggered separately for each server)
  onBeforeUpload: async (context) => {
    console.log('Starting upload to:', context.connectInfo.host)
  },
  onAfterUpload: async (context) => {
    console.log('Upload successful:', context.connectInfo.host)
  },
  
  // 🚀 Deploy stage hooks
  onBeforeDeploy: async (context) => {
    console.log('Starting deployment...', context.sshClients.length)
  },
  onAfterDeploy: async (context) => {
    console.log('Deployment completed!')
  },
  
  // 🧹 Cleanup stage hooks
  onBeforeCleanup: async (context) => {
    console.log('Preparing to cleanup temporary files...', context.zipPath)
  },
  onAfterCleanup: async (context) => {
    console.log('Cleanup completed!')
  },
  
  // ❌ Global error handling hook
  onError: async (context) => {
    console.error('Deployment error:', context.error.code, context.error.message)
    
    // Send error notifications, log errors, etc.
    await sendErrorNotification(context.error)
    
    // Return true to indicate error has been handled, continue execution; return false or nothing to re-throw error
    return false
  }
})
```

### ⚠️ Error Handling

This tool provides structured error handling for easy CI/CD integration:

```js
import { deploy, DeployError, DeployErrorCode } from '@jl-org/deploy'

try {
  await deploy({
    // config...
  })
} catch (error) {
  if (error instanceof DeployError) {
    console.error('Deploy error code:', error.code)
    console.error('Error message:', error.message)
    console.error('Server:', error.serverName)
    console.error('Details:', error.details)
    
    // Execute different handling logic based on error code
    switch (error.code) {
      case DeployErrorCode.BUILD_COMMAND_FAILED:
        // Build failure handling
        break
      case DeployErrorCode.CONNECT_SSH_FAILED:
        // SSH connection failure handling
        break
      case DeployErrorCode.UPLOAD_FILE_FAILED:
        // File upload failure handling
        break
      // ...
    }
  }
}
```

### 🔌 Fully Custom Workflow: Composing Low-Level APIs

When you need a fully custom workflow (e.g. only compress, only upload, or a custom order of steps), you can use the following APIs directly without running the full `deploy` flow.

| API | Description |
| --- | --- |
| **`sshRemote(connectInfo, task)`** | Establish SSH connection and run a callback. Inside `task(client)` you can use `client.exec`, `client.shell`, etc. Returns the return value of `task`. |
| **`sftpRemote(connectInfo, task)`** | Establish SFTP connection and run a callback. Inside `task(sftp)` you can use `sftp.fastPut`, `fastGet`, `readdir`, `mkdir`, etc. Returns the return value of `task`. |
| **`compress(options)`** | Pack a directory into tar.gz. `options`: `{ distDir, zipPath, onProgress? }`, returns `Promise<{ bytesWritten }>`. No console logging; suitable for scripts or custom pipelines. |
| **`startZip(opts)`** | Same as `compress` but with console logging and progress bar; suitable for human-readable deployment. `opts`: `{ distDir, zipPath }`. |

Example: compress only, or compress then upload via SFTP:

```js
import { compress, sftpRemote } from '@jl-org/deploy'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

// Compress only
const { bytesWritten } = await compress({
  distDir: resolve(__dirname, '../dist'),
  zipPath: resolve(__dirname, '../dist.tar.gz'),
  onProgress(processed, total) { console.log(processed, total) }
})

// Then upload via SFTP
await sftpRemote(
  { host: '192.168.1.100', username: 'root', privateKey: readFileSync(resolve(homedir(), '.ssh/id_rsa'), 'utf-8') },
  async (sftp) => {
    await new Promise((res, rej) => {
      sftp.fastPut(resolve(__dirname, '../dist.tar.gz'), '/home/dist.tar.gz', (err) => (err ? rej(err) : res()))
    })
  }
)
```

---

## 📋 Configuration Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `connectInfos` | `ConnectInfo[]` | - | **🔗 Required**, SSH connection info array |
| `buildCmd` | `string` | `'npm run build'` | 🔨 Build command |
| `skipBuild` | `boolean` | `false` | ⚡ Whether to skip build step |
| `interactive` | `boolean` | `false` | 🤝 Whether to enable interactive deployment mode |
| `concurrent` | `boolean` | `true` | 🌐 Whether to deploy to multiple servers concurrently |
| `deployCmd` | `string` | *see below* | 🚀 Remote server deployment command |
| `distDir` | `string` | - | **📁 Required**, build output directory path |
| `zipPath` | `string` | - | **📦 Required**, archive file path |
| `remoteZipPath` | `string` | - | **🌐 Required**, remote archive file path |
| `remoteUnzipDir` | `string` | - | **📁 Required**, remote extraction directory path |
| `remoteBackupDir` | `string` | - | 💾 Remote backup directory path |
| `maxBackupCount` | `number` | `5` | 🔢 Maximum backup count |
| `remoteCwd` | `string` | `'/'` | 📍 Remote command execution path |
| `needRemoveZip` | `boolean` | `true` | 🗑️ Whether to remove local archive file |
| `uploadRetryCount` | `number` | `3` | 🔄 Upload failure retry count |
| `onServerReady` | `function` | - | 🔧 Server ready callback |
| `customUpload` | `function` | - | 📤 Custom upload behavior |
| `customDeploy` | `function` | - | 🎛️ Custom deploy behavior |

### 🎣 Lifecycle Hooks

| Hook | Type | Description |
| --- | --- | --- |
| `onBeforeBuild` | `function` | 🔨 Callback before build stage starts |
| `onAfterBuild` | `function` | ✅ Callback after build stage completes |
| `onBeforeCompress` | `function` | 📦 Callback before compress stage starts |
| `onAfterCompress` | `function` | ✅ Callback after compress stage completes |
| `onBeforeConnect` | `function` | 🔗 Callback before connection stage starts |
| `onAfterConnect` | `function` | ✅ Callback after connection stage completes |
| `onBeforeUpload` | `function` | 📤 Callback before upload stage starts (triggered separately for each server) |
| `onAfterUpload` | `function` | ✅ Callback after upload stage completes (triggered separately for each server) |
| `onBeforeDeploy` | `function` | 🚀 Callback before deploy stage starts |
| `onAfterDeploy` | `function` | ✅ Callback after deploy stage completes |
| `onBeforeCleanup` | `function` | 🧹 Callback before cleanup stage starts |
| `onAfterCleanup` | `function` | ✅ Callback after cleanup stage completes |
| `onError` | `function` | ❌ Global error handling callback |

**🔧 Default Deploy Command:**

```bash
cd ${remoteCwd} &&
rm -rf ${remoteUnzipDir} &&
mkdir -p ${remoteUnzipDir} &&
tar -xzf ${remoteZipPath} -C ${remoteUnzipDir} &&
rm -rf ${remoteZipPath} &&
exit
```

---

## 🚨 Error Codes

Common error codes include:

- `CONFIG_VALIDATION_FAILED` - 📋 Configuration validation failed
- `BUILD_COMMAND_FAILED` - 🔨 Build command execution failed
- `COMPRESS_SOURCE_NOT_FOUND` - 📦 Compress source directory not found
- `CONNECT_SSH_FAILED` - 🔗 SSH connection failed
- `UPLOAD_FILE_FAILED` - 📤 File upload failed
- `DEPLOY_COMMAND_FAILED` - 🚀 Deploy command execution failed
- `USER_CANCELLED` - 🚫 User cancelled operation

For more error codes, please refer to [DeployErrorCode](src/types/error.ts) enum

---

## 🐛 Common Errors

### Correct Usage of `shell.sftp` in Hooks

The `context.shell` in each stage hook provides `exec`, `spawn`, and `sftp` for remote operations. `sftp` uses ssh2's SFTPWrapper and supports APIs like `fastPut`, `fastGet`, `readdir`, `mkdir`, `stat`, etc.

**❌ Wrong**: `fastPut` / `fastGet` are callback-based APIs. Calling them without `await` causes the task to return immediately, closing the SFTP connection before the transfer completes:

```js
onAfterDeploy: async (context) => {
  const { shell } = context
  shell.sftp(async (sftp) => {
    sftp.fastPut(localPath, remotePath, (err) => {
      if (err) console.error(err)
    })
    // ⚠️ The async function returns here immediately, connection closes, upload may be interrupted!
  })
}
```

**✅ Correct**: Wrap the callback-based API in a Promise and `await` it so the connection stays open until the transfer completes:

```js
onAfterDeploy: async (context) => {
  const { shell } = context
  await shell.sftp(async (sftp) => {
    await new Promise((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
}
```

**Note**: Each `shell.sftp(task)` call creates a new SSH connection and closes it when the task returns. All async operations inside the task must be `await`ed so the connection remains open until they finish.

---

## ⚠️ Important Notes

1. 📁 `remoteUnzipDir` should not be in the same directory as `remoteZipPath`, because the deployment process will first delete the `remoteUnzipDir` directory
2. 📝 When using custom `deployCmd`, the command must end with a newline character
3. ⚡ When `skipBuild` is true, it will check if the build output directory exists, and report an error if it doesn't exist
4. 🤖 In CI/CD environments, use `interactive: false` to avoid blocking
5. 🎣 Using hooks allows you to execute custom logic at various stages of the deployment process, facilitating integration of monitoring, notifications, and other features
6. ⚠️ Error handling provides structured error information, making it easy for CI/CD systems to execute different handling strategies based on error codes
