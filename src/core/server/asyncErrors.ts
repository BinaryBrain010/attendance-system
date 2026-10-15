/**
 * Make Express 4 forward rejected promises from async handlers to the error middleware.
 *
 * Express 4 ignores a handler's return value, so an `async` handler that rejects produces an
 * unhandledRejection instead of a 500/503. Combined with winston's rejection handler that used to
 * exit the process, a single bad request could take the whole server down. We wrap
 * Layer.handle_request / handle_error so a returned promise's rejection is routed to `next(err)`,
 * where the global error handler maps it (e.g. Prisma P2024/P2028 -> 503). This mirrors the
 * `express-async-errors` package, inlined to avoid adding a dependency.
 *
 * Import this module once, before any routers are created.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const Layer = require('express/lib/router/layer');

const originalHandleRequest = Layer.prototype.handle_request;
Layer.prototype.handle_request = function handle(this: any, req: any, res: any, next: any) {
  const fn = this.handle;
  if (!fn || fn.length > 3) {
    return originalHandleRequest.call(this, req, res, next);
  }
  try {
    const ret = fn.call(this, req, res, next);
    if (ret && typeof ret.then === 'function') {
      Promise.resolve(ret).catch(next);
    }
  } catch (err) {
    next(err);
  }
};

const originalHandleError = Layer.prototype.handle_error;
Layer.prototype.handle_error = function handle_error(this: any, error: any, req: any, res: any, next: any) {
  const fn = this.handle;
  if (!fn || fn.length !== 4) {
    return originalHandleError.call(this, error, req, res, next);
  }
  try {
    const ret = fn.call(this, error, req, res, next);
    if (ret && typeof ret.then === 'function') {
      Promise.resolve(ret).catch(next);
    }
  } catch (err) {
    next(err);
  }
};

export {};
