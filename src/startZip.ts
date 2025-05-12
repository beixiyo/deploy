import archiver from 'archiver'
import { createWriteStream, existsSync, lstatSync, mkdirSync } from 'fs'
import { dirname } from 'path'
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

    // 1. 校验 distPath 是否存在且为目录
    if (!existsSync(distPath)) {
      return reject(new Error(`打包目录 ${distPath} 不存在`))
    }
    if (!lstatSync(distPath).isDirectory()) {
      return reject(new Error(`路径 ${distPath} 不是一个目录`))
    }

    // 2. 确保 zipPath 的父目录存在
    const zipDir = dirname(zipPath)
    if (!existsSync(zipDir)) {
      try {
        mkdirSync(zipDir, { recursive: true })
        console.log(`---创建压缩包目录 ${zipDir} 成功---`)
      }
      catch (mkdirErr) {
        return reject(new Error(`创建压缩包目录 ${zipDir} 失败: ${mkdirErr}`))
      }
    }
    else if (!lstatSync(zipDir).isDirectory()) {
      return reject(new Error(`路径 ${zipDir} 已存在但不是一个目录`))
    }

    // 定义打包格式和相关配置
    const archive = archiver(
      'tar',
      {
        gzip: true,
        gzipOptions: { level: 9 }
      }
    ).on('error', err => {
      console.error('---压缩过程中发生错误---', err)
      reject(err)
    })

    const output = createWriteStream(zipPath)
    output.on('error', (err) => {
      console.error('---写入压缩文件时发生错误---', err)
      reject(err)
    })

    // 开始压缩
    archive.pipe(output)
    // 文件夹压缩
    archive.directory(distPath, false)
    archive.finalize()

    // 监听流的打包
    output.on('close', () => {
      const sizeInBytes = archive.pointer()
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2)
      console.log(`---目标打包完成: ${zipPath} (大小: ${sizeInMB} MB)---`)
      resolve(true)
    })
  })
}
