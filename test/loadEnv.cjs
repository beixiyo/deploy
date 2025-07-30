// @ts-check
const fs = require('fs')
const path = require('path')

function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '../.env')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8')
      const envLines = envContent.split('\n')

      envLines.forEach(line => {
        // 忽略注释和空行
        if (line.trim() && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=')
          const value = valueParts.join('=').trim()
          if (key && value) {
            process.env[key.trim()] = value
          }
        }
      })
      console.log('已加载 .env 文件')
    }
  }
  catch (err) {
    console.error('加载 .env 文件失败:', err)
  }
}

module.exports = loadEnv