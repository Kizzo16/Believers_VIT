import { z } from "zod";

export const ALLOWED_CONTAINERS = ["sentinel-db", "dummy-api"] as const;
export type AllowedContainer = (typeof ALLOWED_CONTAINERS)[number];

export const ALLOWED_SERVICES = ALLOWED_CONTAINERS;
export type AllowedService = AllowedContainer;

// ==========================================
// OFFICIAL SENTINEL TOOL SCHEMAS
// ==========================================

export const GetServiceLogsArgsSchema = z
  .object({
    service: z
      .enum(ALLOWED_SERVICES, {
        errorMap: () => ({
          message: "Input should be 'sentinel-db' or 'dummy-api'",
        }),
      })
      .default("dummy-api"),
  })
  .strict({
    message: "Extra inputs are not permitted",
  });

export const RestartServiceArgsSchema = z
  .object({
    service: z
      .enum(ALLOWED_SERVICES, {
        errorMap: () => ({
          message: "Input should be 'sentinel-db' or 'dummy-api'",
        }),
      })
      .default("sentinel-db"),
  })
  .strict({
    message: "Extra inputs are not permitted",
  });

export const CheckDatabaseArgsSchema = z
  .object({
    service: z
      .enum(["sentinel-db"] as const, {
        errorMap: () => ({
          message: "Input should be 'sentinel-db'",
        }),
      })
      .default("sentinel-db"),
  })
  .strict({
    message: "Extra inputs are not permitted",
  });

export const CheckServiceArgsSchema = z
  .object({
    service: z
      .enum(["dummy-api"] as const, {
        errorMap: () => ({
          message: "Input should be 'dummy-api'",
        }),
      })
      .default("dummy-api"),
  })
  .strict({
    message: "Extra inputs are not permitted",
  });

export const GetSystemStatusArgsSchema = z
  .object({})
  .strict({
    message: "Extra inputs are not permitted",
  });

export const VerifyRecoveryArgsSchema = z
  .object({
    service: z
      .enum(ALLOWED_SERVICES, {
        errorMap: () => ({
          message: "Input should be 'sentinel-db' or 'dummy-api'",
        }),
      })
      .default("dummy-api"),
  })
  .strict({
    message: "Extra inputs are not permitted",
  });

// ==========================================
// BACKWARD-COMPATIBILITY ALIAS SCHEMAS
// ==========================================

export const GetDockerLogsArgsSchema = z
  .object({
    container_name: z
      .enum(ALLOWED_CONTAINERS, {
        errorMap: () => ({
          message: "Input should be 'sentinel-db' or 'dummy-api'",
        }),
      })
      .default("dummy-api"),
  })
  .strict({
    message: "Extra inputs are not permitted",
  });

export const RestartContainerArgsSchema = z
  .object({
    container_name: z
      .enum(ALLOWED_CONTAINERS, {
        errorMap: () => ({
          message: "Input should be 'sentinel-db' or 'dummy-api'",
        }),
      })
      .default("sentinel-db"),
  })
  .strict({
    message: "Extra inputs are not permitted",
  });

export const DeleteDatabaseArgsSchema = z
  .object({
    db_name: z
      .string({ required_error: "db_name is required" })
      .min(1, { message: "String should have at least 1 character" })
      .max(64, { message: "String should have at most 64 characters" })
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message: "String should match pattern '^[a-zA-Z0-9_-]+$'",
      })
      .default("sentinel"),
  })
  .strict({
    message: "Extra inputs are not permitted",
  });

// ==========================================
// GOVERNANCE & POLICY SCHEMAS
// ==========================================

export const ApprovalRequestSchema = z
  .object({
    approval_id: z.string().min(1, "approval_id cannot be empty"),
    action: z.enum(["APPROVE", "REJECT"], {
      errorMap: () => ({
        message: "Action must be 'APPROVE' or 'REJECT'",
      }),
    }),
  })
  .strict();

export const PolicyUpdateSchema = z
  .object({
    policies: z.record(
      z.string(),
      z.object({
        risk: z.string(),
        auto_execute: z.boolean(),
      })
    ),
  })
  .strict();

// ==========================================
// STRUCTURED RCA SCHEMAS
// ==========================================

export const OFFICIAL_TOOL_NAMES = [
  "get_system_status",
  "get_service_logs",
  "check_database",
  "check_service",
  "restart_service",
  "verify_recovery",
] as const;

export const ALL_EXECUTABLE_TOOLS = [
  ...OFFICIAL_TOOL_NAMES,
  "get_docker_logs",
  "restart_container",
  "delete_database",
] as const;

export const ProposedActionSchema = z
  .object({
    tool: z.enum(ALL_EXECUTABLE_TOOLS, {
      errorMap: () => ({
        message: "Invalid or unsupported tool name in proposed_action",
      }),
    }),
    arguments: z.record(z.unknown()),
  })
  .strict({
    message: "Extra inputs are not permitted in proposed_action",
  });

export const StructuredRcaSchema = z
  .object({
    root_cause: z.string().min(1, { message: "root_cause cannot be empty" }),
    confidence: z
      .number({ required_error: "confidence is required and must be a number" })
      .min(0.0, { message: "confidence must be between 0.0 and 1.0" })
      .max(1.0, { message: "confidence must be between 0.0 and 1.0" }),
    evidence: z
      .array(z.string().min(1, { message: "evidence item cannot be empty" }))
      .min(1, { message: "evidence must contain at least one piece of evidence" }),
    proposed_action: ProposedActionSchema,
  })
  .strict({
    message: "Extra inputs are not permitted in structured RCA",
  });

export type StructuredRca = z.infer<typeof StructuredRcaSchema>;
export type ProposedAction = z.infer<typeof ProposedActionSchema>;

// ==========================================
// REGISTRY MAPPING
// ==========================================

export const TOOL_SCHEMAS = {
  // Official tools
  get_system_status: GetSystemStatusArgsSchema,
  get_service_logs: GetServiceLogsArgsSchema,
  check_database: CheckDatabaseArgsSchema,
  check_service: CheckServiceArgsSchema,
  restart_service: RestartServiceArgsSchema,
  verify_recovery: VerifyRecoveryArgsSchema,
  // Compatibility aliases
  get_docker_logs: GetDockerLogsArgsSchema,
  restart_container: RestartContainerArgsSchema,
  delete_database: DeleteDatabaseArgsSchema,
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;
