"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
const node_path_1 = __importDefault(require("node:path"));
dotenv_1.default.config({ path: node_path_1.default.resolve(process.cwd(), ".env") });
const envSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().default(8000),
    HOST: zod_1.z.string().default("0.0.0.0"),
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    DUMMY_API_URL: zod_1.z.string().url().default("http://localhost:8001/health"),
    POLICIES_FILE: zod_1.z.string().default("./policies.json"),
    GEMINI_API_KEY: zod_1.z.string().optional(),
    GOOGLE_API_KEY: zod_1.z.string().optional(),
    OPENAI_API_KEY: zod_1.z.string().optional(),
    OPENAI_MODEL: zod_1.z.string().default("gpt-5.6"),
});
exports.env = envSchema.parse(process.env);
