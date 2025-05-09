import { Client } from 'ssh2'
import { build } from './build'
import type { DeployOpts } from './types'
import { startZip } from './startZip'
import { connectAndUpload } from './connectAndUpload'
import { unzipAndDeploy } from './unzipAndDeploy'
import { rmSync } from 'fs'
import { getOpts } from './getOpts'
import { splitDeployOpts } from './tool'


export async function deploy(deployOpts: DeployOpts) {
  let sshServers: Client[]
  const opts = getOpts(deployOpts)

  try {
    await build(opts.buildCmd)
    await startZip(opts)

    const singleConnectInfo = splitDeployOpts(opts)

    for (const item of singleConnectInfo) {
      sshServers = deployOpts.customUpload
        ? await deployOpts.customUpload(() => new Client())
        : await connectAndUpload(item)

      deployOpts.customDeploy
        ? await deployOpts.customDeploy(sshServers, item.connectInfos)
        : await unzipAndDeploy(sshServers, item.deployCmd)

      item.needRemoveZip && rmSync(item.zipPath)
    }
  }
  catch (error: any) {
    console.error('Error:', error.message)
  }
  finally {
    if (!sshServers!) return

    sshServers.forEach((item) => {
      item.end()
      item.destroy()
    })
  }
}