"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPersistenceWarning = logPersistenceWarning;
exports.safePersist = safePersist;
const logger_1 = require("./logger");
/**
 * Logs a standardized database persistence warning without leaking credentials or interrupting runtime flow.
 */
function logPersistenceWarning(repository, operation, targetId, err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger_1.logger.warn(`[Persistence Warning] ${repository}.${operation}${targetId ? ` (ID: ${targetId})` : ""} failed: ${errMsg}`);
}
/**
 * Safely executes a database persistence operation with non-blocking error containment.
 * Returns null if the operation fails, ensuring caller workflow is never broken.
 */
async function safePersist(repository, operation, targetId, fn) {
    try {
        return await fn();
    }
    catch (err) {
        logPersistenceWarning(repository, operation, targetId, err);
        return null;
    }
}
