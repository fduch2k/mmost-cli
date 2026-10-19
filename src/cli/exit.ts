type Flushable = {
  write: (chunk: string, callback: () => void) => unknown;
  once: (event: 'error', listener: () => void) => unknown;
};

// An empty write completes only after every chunk queued before it. A reader
// that went away (`mmost ... | head`) fails it with EPIPE: nothing to wait for.
export function flush(stream: Flushable): Promise<void> {
  return new Promise(resolve => {
    stream.once('error', () => resolve());
    stream.write('', () => resolve());
  });
}

// process.exit() drops whatever a pipe has not taken yet: on macOS writes to a
// pipe are asynchronous, and `mmost ... | jq` got the first 64 KiB with exit 0.
export async function exitAfterFlush(
  code: number,
  streams: Flushable[] = [process.stdout, process.stderr],
  exit: (code: number) => void = process.exit,
): Promise<void> {
  await Promise.all(streams.map(flush));
  exit(code);
}
