import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { HTTP_STATUS, type ErrorCode } from "@tools/contracts";

export type HttpApp = FastifyInstance;
export type HttpRequest = FastifyRequest;

export class AppError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
  get status(): number {
    return HTTP_STATUS[this.code];
  }
}

/** PostgreSQL unique_violation; apps map it to DUPLICATE_REQUEST. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export function sendError(reply: FastifyReply, request: FastifyRequest, status: number, code: string, message: string) {
  return reply.status(status).send({ code, message, requestId: request.id });
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError | Error, request, reply) => {
    if (err instanceof AppError) return sendError(reply, request, err.status, err.code, err.message);
    if (err instanceof ZodError) return sendError(reply, request, HTTP_STATUS.VALIDATION, "VALIDATION", "invalid request body");
    const fastifyErr = err as FastifyError;
    if (fastifyErr.statusCode && fastifyErr.statusCode >= 400 && fastifyErr.statusCode < 500) {
      const code = fastifyErr.statusCode === 404 ? "NOT_FOUND" : "VALIDATION";
      return sendError(reply, request, fastifyErr.statusCode === 404 ? 404 : 422, code, fastifyErr.message);
    }
    request.log.error({ err: { name: err.name, message: err.message }, reqId: request.id }, "unhandled error");
    return sendError(reply, request, 500, "INTERNAL", "internal error");
  });
  app.setNotFoundHandler((request, reply) => sendError(reply, request, 404, "NOT_FOUND", "route not found"));
}
