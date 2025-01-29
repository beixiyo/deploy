import { spawn } from 'node:child_process'

/**
 * 本地构建项目
 */
export async function build(cmd: string) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, {
      shell: true,
      stdio: 'inherit'
    })
    
    proc.on('exit', code => {
      if (code === 0) {
        console.log('---构建成功---')
        resolve()
      }
      else {
        reject(new Error('构建失败'))
      }
    })
  })
}