import archiver from 'archiver'
import { createWriteStream, existsSync, lstatSync, mkdirSync } from 'fs'
import { dirname, relative, sep } from 'path'
import type { CompressOptions, DeployOpts } from './types'
import { logger } from './logger'
import { updateProgress } from './tool'
import { DeployErrorCode, DeployError } from './types'

/** 校验并确保压缩源目录与输出目录就绪，失败时抛出 DeployError */
function ensureCompressSourceAndOutputDir(distDir: string, zipPath: string): void {
  if (!existsSync(distDir)) {
    throw new DeployError(
      DeployErrorCode.COMPRESS_SOURCE_NOT_FOUND,
      `打包目录 ${distDir} 不存在`
    )
  }
  if (!lstatSync(distDir).isDirectory()) {
    throw new DeployError(
      DeployErrorCode.COMPRESS_SOURCE_NOT_FOUND,
      `路径 ${distDir} 不是一个目录`
    )
  }

  const zipDir = dirname(zipPath)
  if (!existsSync(zipDir)) {
    try {
      mkdirSync(zipDir, { recursive: true })
    }
    catch (mkdirErr) {
      throw new DeployError(
        DeployErrorCode.COMPRESS_CREATE_DIR_FAILED,
        `创建压缩包目录 ${zipDir} 失败`,
        mkdirErr
      )
    }
  }
  else if (!lstatSync(zipDir).isDirectory()) {
    throw new DeployError(
      DeployErrorCode.COMPRESS_CREATE_DIR_FAILED,
      `路径 ${zipDir} 已存在但不是一个目录`
    )
  }
}

/** 计算是否应忽略 zipPath（当 zip 位于 distDir 内部时避免自打包） */
function getArchiveIgnoreGlob(distDir: string, zipPath: string): string[] {
  const relativeZipPath = relative(distDir, zipPath)
  const shouldIgnoreZip = relativeZipPath
    && !relativeZipPath.startsWith('..')
    && !relativeZipPath.includes(':')
  return shouldIgnoreZip
    ? [relativeZipPath.split(sep).join('/')]
    : []
}

/**
 * 将指定目录压缩为 tar.gz，可单独使用或配合部署流程。
 * @param options.distDir 待压缩目录
 * @param options.zipPath 输出文件路径
 * @param options.onProgress 可选进度回调 (processedBytes, totalBytes)
 * @returns 压缩完成后的字节数
 */
export function compress(options: CompressOptions): Promise<{ bytesWritten: number }> {
  const { distDir, zipPath, onProgress } = options

  ensureCompressSourceAndOutputDir(distDir, zipPath)
  const globIgnore = getArchiveIgnoreGlob(distDir, zipPath)

  return new Promise((resolve, reject) => {
    const archive = archiver('tar', {
      gzip: true,
      gzipOptions: { level: 9 },
    })
      .on('error', (err) => {
        reject(new DeployError(
          DeployErrorCode.COMPRESS_ARCHIVE_FAILED,
          '压缩过程中发生错误',
          err
        ))
      })
      .on('progress', (progress) => {
        onProgress?.(progress.fs.processedBytes, progress.fs.totalBytes)
      })

    const output = createWriteStream(zipPath)
    output.on('error', (err) => {
      reject(new DeployError(
        DeployErrorCode.COMPRESS_WRITE_FAILED,
        '写入压缩文件时发生错误',
        err
      ))
    })

    output.on('close', () => {
      resolve({ bytesWritten: archive.pointer() })
    })

    archive.pipe(output)
    archive.glob('**/*', {
      cwd: distDir,
      dot: true,
      ignore: globIgnore,
    })
    archive.finalize()
  })
}

/**
 * 将打包后的文件压缩成 tar.gz（带日志与进度展示，用于部署流程）
 */
export async function startZip(
  opts: Pick<DeployOpts, 'zipPath' | 'distDir'>
): Promise<void> {
  logger.info('开始压缩文件')

  const { bytesWritten } = await compress({
    distDir: opts.distDir,
    zipPath: opts.zipPath,
    onProgress(processedBytes, totalBytes) {
      updateProgress(
        processedBytes,
        totalBytes,
        (percent, progressText) => {
          logger.progress({
            message: '压缩进度:',
            current: processedBytes,
            total: totalBytes,
            displayType: 'percentage',
            customText: progressText,
            sameLine: true,
          })
        }
      )
    },
  })

  const sizeInMB = (bytesWritten / (1024 * 1024)).toFixed(2)
  logger.success(`目标打包完成: ${opts.zipPath} (大小: ${sizeInMB} MB)`)
}
