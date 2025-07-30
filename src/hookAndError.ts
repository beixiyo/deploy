import type { ErrorHookContext, HookContext } from './types'
import { DeployErrorCode, DeployError } from './types'


/**
 * Hook 执行工具函数
 */
export async function executeHook<T extends HookContext>(
  hook: ((context: T) => Promise<void> | void) | undefined,
  context: T
): Promise<void> {
  if (hook) {
    try {
      await hook(context)
    }
    catch (error) {
      throw new DeployError(
        DeployErrorCode.UNKNOWN_ERROR,
        `Hook execution failed in stage ${context.stage}`,
        error,
        context.connectInfo?.name || context.connectInfo?.host
      )
    }
  }
}

/**
 * 执行错误处理 Hook
 */
export async function handleError(
  error: Error | DeployError,
  onError: ((context: ErrorHookContext) => Promise<boolean | void> | boolean | void) | undefined,
  context: Omit<ErrorHookContext, 'error'>
): Promise<boolean> {
  const deployError = error instanceof DeployError
    ? error
    : new DeployError(DeployErrorCode.UNKNOWN_ERROR, error.message, error)

  if (onError) {
    try {
      const result = await onError({
        ...context,
        error: deployError
      })
      return Boolean(result)
    }
    catch (hookError) {
      console.error('Error hook execution failed:', hookError)
      return false
    }
  }

  return false
}
