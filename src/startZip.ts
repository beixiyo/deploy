import archiver from 'archiver'
import { createWriteStream } from 'fs'
import type { DeployOpts } from './types'


/**
 * 将打包后的文件压缩成 zip
 */
export async function startZip(
  {
    distPath,
    zipPath
  }: Pick<DeployOpts, 'zipPath' | 'distPath'>
) {
  return new Promise((resolve, reject) => {
    console.log('---开始压缩---')
    // 定义打包格式和相关配置
    const archive = archiver(
      'tar',
      {
        gzip: true,
        gzipOptions: { level: 9 }
      }
    ).on('error', err => reject(err))

    const output = createWriteStream(zipPath)

    // 开始压缩
    archive.pipe(output)
    // 文件夹压缩
    archive.directory(distPath, false)
    archive.finalize()

    // 监听流的打包
    output.on('close', () => {
      console.log('---目标打包完成---')
      resolve(true)
    })
  })
}
