/**
 * Reads an SSE stream sent as POST response (not EventSource-compatible).
 * Backend emits lines of form: `data: {json}\n\n`.
 * Yields parsed JSON payloads.
 */
export async function* readSSE<T = unknown>(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<T, void, void> {
  if (!response.body) throw new Error("No response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIdx;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const eventChunk = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        for (const line of eventChunk.split("\n")) {
          const trimmed = line.replace(/^data:\s?/, "");
          if (!trimmed) continue;
          try {
            yield JSON.parse(trimmed) as T;
          } catch {
            /* ignore non-JSON keepalives */
          }
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
}
