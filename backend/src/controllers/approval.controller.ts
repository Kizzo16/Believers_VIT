import { FastifyReply, FastifyRequest } from "fastify";
import { ApprovalRequestSchema } from "../safety/schemas";
import { ApprovalService } from "../services/approval.service";

export async function approveActionHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = ApprovalRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({
      detail: `Invalid action request: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
    });
  }

  try {
    const result = await ApprovalService.handleApproval(
      parsed.data.approval_id,
      parsed.data.action
    );
    return reply.status(200).send(result);
  } catch (err: unknown) {
    const statusCode =
      typeof err === "object" && err !== null && "statusCode" in err && typeof err.statusCode === "number"
        ? err.statusCode
        : 500;

    const detail = err instanceof Error ? err.message : String(err);
    return reply.status(statusCode).send({ detail });
  }
}
