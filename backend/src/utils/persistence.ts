import { logger } from "./logger";

/**
 * Logs a standardized database persistence warning without leaking credentials or interrupting runtime flow.
 */
export function logPersistenceWarning(
  repository: string,
  operation: string,
  targetId: string | null | undefined,
  err: unknown
): void {
  const errMsg = err instanceof Error ? err.message : String(err);
  logger.warn(
    `[Persistence Warning] ${repository}.${operation}${targetId ? ` (ID: ${targetId})` : ""} failed: ${errMsg}`
  );
}

/**
 * Safely executes a database persistence operation with non-blocking error containment.
 * Returns null if the operation fails, ensuring caller workflow is never broken.
 */
export async function safePersist<T>(
  repository: string,
  operation: string,
  targetId: string | null | undefined,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (err: unknown) {
    logPersistenceWarning(repository, operation, targetId, err);
    return null;
  }
}
