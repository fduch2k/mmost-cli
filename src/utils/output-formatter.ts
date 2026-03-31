export function formatErrorOutput(error: unknown): { message: string; json: string } {
  const message = error instanceof Error ? error.message : String(error);
  return {
    message,
    json: `${JSON.stringify({ error: message })}\n`,
  };
}
