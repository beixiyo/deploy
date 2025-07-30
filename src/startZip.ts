import archiver from 'archiver'
import { createWriteStream, existsSync, lstatSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import type { DeployOpts } from './types'
import { logger } from './logger'
import { updateProgress } from './tool'


/**
 * 将打包后的文件压缩成 zip
 */
export async function startZip(
  {
    distDir,
    zipPath
  }: Pick<DeployOpts, 'zipPath' | 'distDir'>
) {
  return new Promise((resolve, reject) => {
    logger.info('开始压缩文件')

    // 1. 校验 distDir 是否存在且为目录
    if (!existsSync(distDir)) {
      return reject(new Error(`打包目录 ${distDir} 不存在`))
    }
    if (!lstatSync(distDir).isDirectory()) {
      return reject(new Error(`路径 ${distDir} 不是一个目录`))
    }

    // 2. 确保 zipPath 的父目录存在
    const zipDir = dirname(zipPath)
    if (!existsSync(zipDir)) {
      try {
        mkdirSync(zipDir, { recursive: true })
        logger.success(`创建压缩包目录 ${zipDir} 成功`)
      }
      catch (mkdirErr) {
        return reject(new Error(`创建压缩包目录 ${zipDir} 失败: ${mkdirErr}`))
      }
    }
    else if (!lstatSync(zipDir).isDirectory()) {
      return reject(new Error(`路径 ${zipDir} 已存在但不是一个目录`))
    }

    const archive = archiver(
      'tar',
      {
        gzip: true,
        gzipOptions: { level: 9 }
      }
    )
      .on('error', err => {
        logger.error('压缩过程中发生错误', err)
        reject(err)
      })
      .on('progress', (progress) => {
        updateProgress(
          progress.fs.processedBytes,
          progress.fs.totalBytes,
          (percent, progressText) => {
            logger.progress({
              message: '压缩进度:',
              current: progress.fs.processedBytes,
              total: progress.fs.totalBytes,
              displayType: 'percentage',
              customText: progressText,
              sameLine: true
            })
          }
        )
      })

    const output = createWriteStream(zipPath)
    output.on('error', (err) => {
      logger.error('写入压缩文件时发生错误', err)
      reject(err)
    })

    // 开始压缩
    archive.pipe(output)
    // 文件夹压缩
    archive.directory(distDir, false)
    archive.finalize()

    // 监听流的打包
    output.on('close', () => {
      const sizeInBytes = archive.pointer()
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2)
      logger.success(`目标打包完成: ${zipPath} (大小: ${sizeInMB} MB)`)
      resolve(true)
    })
  })
}
