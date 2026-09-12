"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_SCHEMAS = exports.StructuredRcaSchema = exports.ProposedActionSchema = exports.ALL_EXECUTABLE_TOOLS = exports.OFFICIAL_TOOL_NAMES = exports.PolicyUpdateSchema = exports.ApprovalRequestSchema = exports.DeleteDatabaseArgsSchema = exports.RestartContainerArgsSchema = exports.GetDockerLogsArgsSchema = exports.VerifyRecoveryArgsSchema = exports.GetSystemStatusArgsSchema = exports.CheckServiceArgsSchema = exports.CheckDatabaseArgsSchema = exports.RestartServiceArgsSchema = exports.GetServiceLogsArgsSchema = exports.ALLOWED_SERVICES = exports.ALLOWED_CONTAINERS = void 0;
const zod_1 = require("zod");
exports.ALLOWED_CONTAINERS = ["sentinel-db", "dummy-api"];
exports.ALLOWED_SERVICES = exports.ALLOWED_CONTAINERS;
// ==========================================
// OFFICIAL SENTINEL TOOL SCHEMAS
// ==========================================
exports.GetServiceLogsArgsSchema = zod_1.z
    .object({
    service: zod_1.z
        .enum(exports.ALLOWED_SERVICES, {
        errorMap: () => ({
            message: "Input should be 'sentinel-db' or 'dummy-api'",
        }),
    })
        .default("dummy-api"),
})
    .strict({
    message: "Extra inputs are not permitted",
});
exports.RestartServiceArgsSchema = zod_1.z
    .object({
    service: zod_1.z
        .enum(exports.ALLOWED_SERVICES, {
        errorMap: () => ({
            message: "Input should be 'sentinel-db' or 'dummy-api'",
        }),
    })
        .default("sentinel-db"),
})
    .strict({
    message: "Extra inputs are not permitted",
});
exports.CheckDatabaseArgsSchema = zod_1.z
    .object({
    service: zod_1.z
        .enum(["sentinel-db"], {
        errorMap: () => ({
            message: "Input should be 'sentinel-db'",
        }),
    })
        .default("sentinel-db"),
})
    .strict({
    message: "Extra inputs are not permitted",
});
exports.CheckServiceArgsSchema = zod_1.z
    .object({
    service: zod_1.z
        .enum(["dummy-api"], {
        errorMap: () => ({
            message: "Input should be 'dummy-api'",
        }),
    })
        .default("dummy-api"),
})
    .strict({
    message: "Extra inputs are not permitted",
});
exports.GetSystemStatusArgsSchema = zod_1.z
    .object({})
    .strict({
    message: "Extra inputs are not permitted",
});
exports.VerifyRecoveryArgsSchema = zod_1.z
    .object({
    service: zod_1.z
        .enum(exports.ALLOWED_SERVICES, {
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
exports.GetDockerLogsArgsSchema = zod_1.z
    .object({
    container_name: zod_1.z
        .enum(exports.ALLOWED_CONTAINERS, {
        errorMap: () => ({
            message: "Input should be 'sentinel-db' or 'dummy-api'",
        }),
    })
        .default("dummy-api"),
})
    .strict({
    message: "Extra inputs are not permitted",
});
exports.RestartContainerArgsSchema = zod_1.z
    .object({
    container_name: zod_1.z
        .enum(exports.ALLOWED_CONTAINERS, {
        errorMap: () => ({
            message: "Input should be 'sentinel-db' or 'dummy-api'",
        }),
    })
        .default("sentinel-db"),
})
    .strict({
    message: "Extra inputs are not permitted",
});
exports.DeleteDatabaseArgsSchema = zod_1.z
    .object({
    db_name: zod_1.z
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
exports.ApprovalRequestSchema = zod_1.z
    .object({
    approval_id: zod_1.z.string().min(1, "approval_id cannot be empty"),
    action: zod_1.z.enum(["APPROVE", "REJECT"], {
        errorMap: () => ({
            message: "Action must be 'APPROVE' or 'REJECT'",
        }),
    }),
})
    .strict();
exports.PolicyUpdateSchema = zod_1.z
    .object({
    policies: zod_1.z.record(zod_1.z.string(), zod_1.z.object({
        risk: zod_1.z.string(),
        auto_execute: zod_1.z.boolean(),
    })),
})
    .strict();
// ==========================================
// STRUCTURED RCA SCHEMAS
// ==========================================
exports.OFFICIAL_TOOL_NAMES = [
    "get_system_status",
    "get_service_logs",
    "check_database",
    "check_service",
    "restart_service",
    "verify_recovery",
];
exports.ALL_EXECUTABLE_TOOLS = [
    ...exports.OFFICIAL_TOOL_NAMES,
    "get_docker_logs",
    "restart_container",
    "delete_database",
];
exports.ProposedActionSchema = zod_1.z
    .object({
    tool: zod_1.z.enum(exports.ALL_EXECUTABLE_TOOLS, {
        errorMap: () => ({
            message: "Invalid or unsupported tool name in proposed_action",
        }),
    }),
    arguments: zod_1.z.record(zod_1.z.unknown()),
})
    .strict({
    message: "Extra inputs are not permitted in proposed_action",
});
exports.StructuredRcaSchema = zod_1.z
    .object({
    root_cause: zod_1.z.string().min(1, { message: "root_cause cannot be empty" }),
    confidence: zod_1.z
        .number({ required_error: "confidence is required and must be a number" })
        .min(0.0, { message: "confidence must be between 0.0 and 1.0" })
        .max(1.0, { message: "confidence must be between 0.0 and 1.0" }),
    evidence: zod_1.z
        .array(zod_1.z.string().min(1, { message: "evidence item cannot be empty" }))
        .min(1, { message: "evidence must contain at least one piece of evidence" }),
    proposed_action: exports.ProposedActionSchema,
})
    .strict({
    message: "Extra inputs are not permitted in structured RCA",
});
// ==========================================
// REGISTRY MAPPING
// ==========================================
exports.TOOL_SCHEMAS = {
    // Official tools
    get_system_status: exports.GetSystemStatusArgsSchema,
    get_service_logs: exports.GetServiceLogsArgsSchema,
    check_database: exports.CheckDatabaseArgsSchema,
    check_service: exports.CheckServiceArgsSchema,
    restart_service: exports.RestartServiceArgsSchema,
    verify_recovery: exports.VerifyRecoveryArgsSchema,
    // Compatibility aliases
    get_docker_logs: exports.GetDockerLogsArgsSchema,
    restart_container: exports.RestartContainerArgsSchema,
    delete_database: exports.DeleteDatabaseArgsSchema,
};
