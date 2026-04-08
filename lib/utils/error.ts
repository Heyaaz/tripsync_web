export function getApiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: { message?: string } } } })
    ?.response?.data?.error?.message;
  return typeof message === 'string' ? message : fallback;
}
