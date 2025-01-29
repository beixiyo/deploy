import { Client } from 'ssh2'
import { build } from './build'
import type { DeployOpts } from './types'
import { startZip } from './startZip'
import { connectAndUpload } from './connectAndUpload'
import { unzipAndDeploy } from './unzipAndDeploy'
import { rmSync } from 'fs'
import { getOpts } from './getOpts'


export async function deploy(deployOpts: DeployOpts) {
  let sshServers: Client[]
  const opts = getOpts(deployOpts)

  try {
    await build(opts.buildCmd)
    await startZip(opts)
    sshServers = await connectAndUpload(opts)
    await unzipAndDeploy(sshServers, opts.deployCmd)
    rmSync(opts.zipPath)
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