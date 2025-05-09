import type { DeployOpts } from './types'

/**
 * 失败后自动重试请求
 * @param task 任务函数，返回一个 Promise
 * @param maxCount 剩余重试次数，默认 3
 */
export function retryTask<T>(
  task: () => Promise<T>,
  maxCount = 3
): Promise<T> {
  return task()
    .then(res => res)
    .catch((err) => { // 捕获错误
      const remainingRetries = maxCount - 1
      if (remainingRetries <= 0) {
        console.error('任务失败，重试次数已耗尽:', err)
        return Promise.reject('重试次数耗尽')
      }
      else {
        console.warn(`任务失败，剩余重试次数: ${remainingRetries}`, err)
        // 等待一小段时间再重试，避免立即重试导致连续失败（可选）
        // await new Promise(resolve => setTimeout(resolve, 1000));
        return retryTask(task, remainingRetries) // 递归调用 retryTask
      }
    })
}

/**
 * - 把配置信息的 connectInfos 拆分成多个配置信息
 * - 每个配置信息只有一个 connectInfo
 */
export function splitDeployOpts(deployOpts: DeployOpts) {
  const res: DeployOpts[] = []

  for (let i = 0; i < deployOpts.connectInfos.length; i++) {
     const connectInfo = deployOpts.connectInfos[i]
     res.push({
        ...deployOpts,
        connectInfos: [connectInfo],
     })
  }

  return res
}