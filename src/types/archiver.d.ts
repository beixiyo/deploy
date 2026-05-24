declare module 'archiver' {
  import { Readable, Transform } from 'stream'
  import { ZlibOptions } from 'zlib'

  interface ArchiverOptions {
    gzip?: boolean
    gzipOptions?: ZlibOptions
    statConcurrency?: number
  }

  interface EntryData {
    name: string
    prefix?: string
    date?: Date | string
    mode?: number
    stats?: import('fs').Stats
    [key: string]: unknown
  }

  interface GlobOptions {
    cwd?: string
    dot?: boolean
    ignore?: string[]
    pattern?: string
    stat?: boolean
  }

  interface ProgressData {
    entries: { total: number; processed: number }
    fs: { totalBytes: number; processedBytes: number }
  }

  class Archiver extends Transform {
    append(source: Buffer | Readable | string, data: EntryData): this
    directory(dirpath: string, destpath: string | false, data?: EntryData | ((entry: EntryData) => EntryData | false)): this
    file(filepath: string, data?: EntryData): this
    glob(pattern: string, options?: GlobOptions, data?: EntryData): this
    symlink(filepath: string, target: string, mode?: number): this
    finalize(): Promise<void>
    abort(): this
    pointer(): number

    on(event: 'error', listener: (err: Error) => void): this
    on(event: 'progress', listener: (progress: ProgressData) => void): this
    on(event: 'entry', listener: (entry: EntryData) => void): this
    on(event: 'close' | 'end' | 'finish', listener: () => void): this
    on(event: string, listener: (...args: any[]) => void): this
  }

  class TarArchive extends Archiver {
    constructor(options?: ArchiverOptions)
  }

  class ZipArchive extends Archiver {
    constructor(options?: ArchiverOptions)
  }

  class JsonArchive extends Archiver {
    constructor(options?: ArchiverOptions)
  }

  export { Archiver, ArchiverOptions, EntryData, GlobOptions, JsonArchive, ProgressData, TarArchive, ZipArchive }
}
