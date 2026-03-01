import { homedir } from 'node:os'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export function getEnv(name: string, defaultValue = '', required = false): string {
  const value = process.env[name] || defaultValue
  if (required && !value) {
    console.error(`错误: 环境变量 ${name} 未设置，这是必需的变量`)
    process.exit(1)
  }
  return value || ''
}

export function getSSHKey(): string {
  if (process.env.SSH_PRIVATE_KEY) return process.env.SSH_PRIVATE_KEY
  const customPath = process.env.SSH_KEY_PATH
  if (customPath && existsSync(customPath)) return readFileSync(customPath, 'utf-8')
  const defaultPath = resolve(homedir(), '.ssh/id_rsa')
  if (existsSync(defaultPath)) return readFileSync(defaultPath, 'utf-8')
  console.error('错误: 无法找到 SSH 私钥，请设置环境变量 SSH_PRIVATE_KEY 或 SSH_KEY_PATH')
  process.exit(1)
}

export function getSSHKeyOptional(): string | null {
  if (process.env.SSH_PRIVATE_KEY) return process.env.SSH_PRIVATE_KEY
  const customPath = process.env.SSH_KEY_PATH
  if (customPath && existsSync(customPath)) return readFileSync(customPath, 'utf-8')
  const paths = [resolve(homedir(), '.ssh/id_rsa'), resolve(homedir(), '.ssh/id_ed25519')]
  for (const p of paths) {
    if (existsSync(p)) return readFileSync(p, 'utf-8')
  }
  return null
}
