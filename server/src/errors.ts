export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export function asyncRoute(
  handler: (request: import('express').Request, response: import('express').Response) => Promise<unknown>,
) {
  return (
    request: import('express').Request,
    response: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    void handler(request, response).catch(next)
  }
}
