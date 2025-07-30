// @ts-check
const { homedir } = require('node:os')
const { readFileSync, existsSync } = require('node:fs')
const { resolve } = require('node:path')

/**
 * 读取环境变量，如果不存在则使用默认值或显示错误信息
 * @param {string} name 环境变量名称
 * @param {string} [defaultValue] 默认值
 * @param {boolean} [required=false] 是否必需
 * @returns {string} 环境变量的值
 */
function getEnv(name, defaultValue, required = false) {
  const value = process.env[name] || defaultValue
  if (required && !value) {
    console.error(`错误: 环境变量 ${name} 未设置，这是必需的变量`)
    process.exit(1)
  }
  return value || ''
}

// 获取 SSH 连接信息
function getSSHKey() {
  // 首先检查环境变量
  if (process.env.SSH_PRIVATE_KEY) {
    return process.env.SSH_PRIVATE_KEY
  }

  // 然后检查自定义路径
  const customPath = process.env.SSH_KEY_PATH
  if (customPath && existsSync(customPath)) {
    return readFileSync(customPath, 'utf-8')
  }

  // 最后使用默认路径
  const defaultPath = resolve(homedir(), '.ssh/id_rsa')
  if (existsSync(defaultPath)) {
    return readFileSync(defaultPath, 'utf-8')
  }

  console.error('错误: 无法找到 SSH 私钥，请设置环境变量 SSH_PRIVATE_KEY 或 SSH_KEY_PATH')
  process.exit(1)
}

module.exports = {
  getEnv,
  getSSHKey,
}