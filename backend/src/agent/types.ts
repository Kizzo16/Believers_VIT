import { StructuredRca, ProposedAction } from "../safety/schemas";

export type { StructuredRca, ProposedAction };

export interface ToolExecutionResult {
  status: "SUCCESS" | "ERROR" | "Requires Human Approval";
  result?: unknown;
  message?: string;
  error_type?: string;
  approval_id?: string;
  risk?: string;
  tool_name?: string;
  kwargs?: Record<string, unknown>;
  details?: unknown;
}

export type ToolFunction = (kwargs: Record<string, unknown>) => Promise<string> | string;

export interface ToolParameterProperty {
  type: string;
  description: string;
  enum?: readonly string[] | string[];
  default?: string | number | boolean;
}

export interface ToolParametersSchema {
  type: "object";
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface SentinelToolDefinition {
  name: string;
  description: string;
  isExecutable: boolean;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  parameters: ToolParametersSchema;
}

export interface OpenAiToolDeclaration {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ToolParametersSchema;
  };
}

export interface ToolCallRequest {
  id?: string;
  tool: string;
  arguments: Record<string, unknown>;
}
