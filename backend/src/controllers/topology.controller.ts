import { FastifyReply, FastifyRequest } from "fastify";
import { topologyService } from "../services/topology.service";

export async function getTopologyHandler(_req: FastifyRequest, reply: FastifyReply) {
  const data = topologyService.getTopologyWithHealth();
  return reply.send(data);
}

export async function getImpactHandler(
  req: FastifyRequest<{ Params: { serviceId: string } }>,
  reply: FastifyReply
) {
  const { serviceId } = req.params;
  const service = topologyService.getService(serviceId);

  if (!service) {
    return reply.status(404).send({ error: `Service '${serviceId}' not found in topology graph.` });
  }

  const upstream = topologyService.getUpstreamDependencies(serviceId);
  const downstream = topologyService.getDownstreamImpact(serviceId);

  return reply.send({
    service,
    upstream_dependencies: upstream,
    downstream_impact: downstream,
  });
}
