import { Client } from 'ssh2'


/**
 * 解压并部署
 */
export async function unzipAndDeploy(
  sshServers: Client[],
  deployCmd: string
) {
  return Promise.all(
    sshServers.map((sshServer) => new Promise<void>((resolve, reject) => {
      sshServer.shell((err, stream) => {
        if (err) {
          return reject(err)
        }

        console.log('终端执行命令:', deployCmd)

        stream
          .on('exit', () => {
            console.log('命令执行完毕')
            resolve()
          })
          .stderr.on('data', data => console.error('Error:', data.toString()))

        stream.end(deployCmd)
      })
    }))
  )
}