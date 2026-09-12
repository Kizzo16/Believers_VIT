import { FastifyReply, FastifyRequest } from "fastify";
import { actionExecutorService } from "../services/action-executor.service";

export async function executeActionHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = (req.body || {}) as { tool_name?: string; kwargs?: Record<string, unknown> };
  const toolName = body.tool_name || "restart_service";
  const kwargs = body.kwargs || {};

  const receipt = await actionExecutorService.executeAction(toolName, kwargs);
  return reply.send({
    status: "SUCCESS",
    receipt,
  });
}

export async function getExecutionHistoryHandler(_req: FastifyRequest, reply: FastifyReply) {
  const history = actionExecutorService.getExecutionHistory();
  return reply.send({
    status: "SUCCESS",
    history,
  });
}
