import { EventEmitter } from 'events';

import { exitAfterFlush } from '../exit';

class SlowStream extends EventEmitter {
  pending: Array<() => void> = [];

  write(_chunk: string, callback: () => void) {
    this.pending.push(callback);
    return false;
  }

  drainAll() {
    this.pending.splice(0).forEach(callback => callback());
  }
}

describe('exitAfterFlush', () => {
  it('exits only after every stream has flushed', async () => {
    const stdout = new SlowStream();
    const stderr = new SlowStream();
    const exit = jest.fn();

    const done = exitAfterFlush(3, [stdout, stderr], exit);
    await Promise.resolve();
    expect(exit).not.toHaveBeenCalled();

    stdout.drainAll();
    await Promise.resolve();
    expect(exit).not.toHaveBeenCalled();

    stderr.drainAll();
    await done;
    expect(exit).toHaveBeenCalledWith(3);
  });

  it('exits when the reader has gone away (EPIPE)', async () => {
    const stdout = new SlowStream();
    const exit = jest.fn();

    const done = exitAfterFlush(0, [stdout], exit);
    stdout.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
    await done;
    expect(exit).toHaveBeenCalledWith(0);
  });
});
