import { Client } from 'ssh2'
import type { DeployOpts } from './types'

/**
 * 将 zip 文件传输至远程服务器
 */
export async function connectAndUpload(
  {
    zipPath,
    remoteZipPath,
    connectInfos
  }: Pick<DeployOpts, 'zipPath' | 'remoteZipPath' | 'connectInfos'>
) {
  const sshServers: Client[] = []

  const servers = connectInfos.map((connectInfo) => new Promise<void>((resolve, reject) => {
    const sshServer = new Client()
    sshServers.push(sshServer)

    sshServer
      .on('ready', () => {
        console.log(`--连接服务器 ${connectInfo.name ?? ''}: ${connectInfo.host} 成功--`)

        sshServer.sftp((err, sftp) => {
          if (err) {
            return reject(err)
          }

          sftp.fastPut(zipPath, remoteZipPath, {}, (err) => {
            if (err) {
              return reject(err)
            }

            console.log(`---${connectInfo.name ?? ''}: 压缩包上传成功---`)
            resolve()
          })
        })
      })
      .on('error', err => reject(err))
      .connect(connectInfo)
  }))

  await Promise.all(servers)
  return sshServers
}