import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRealtimeSession, mergeTranscription } from './session';

function deferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createStream() {
  const track = { readyState: 'live', stop: vi.fn() };
  return {
    stream: {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    },
    track,
  };
}

function createSession(overrides = {}) {
  const states = [];
  const video = { srcObject: null };
  const session = createRealtimeSession({
    getVideoElement: () => video,
    getCanvasElement: () => null,
    getSocketUrl: () => 'wss://example.test/api/socket',
    onStateChange: (state, reason) => states.push({ state, reason }),
    onMessage: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  });

  return { session, states, video };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('realtime session', () => {
  it('merges server snapshots without duplicating deltas', () => {
    expect(mergeTranscription('привет', { text: 'мир' })).toBe('привет мир');
    expect(mergeTranscription('старый текст', { full_text: 'новый текст', text: 'текст' }))
      .toBe('новый текст');
  });

  it('cancels while camera permission is pending and stops a late stream', async () => {
    const camera = deferred();
    const { stream, track } = createStream();
    const { session, states } = createSession({
      mediaDevices: { getUserMedia: () => camera.promise },
    });

    const startPromise = session.start();
    session.stop('cancelled');
    camera.resolve(stream);

    await expect(startPromise).resolves.toBe(false);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(states.at(-1)).toEqual({ state: 'idle', reason: 'cancelled' });
  });

  it('closes a websocket that never finishes its handshake', async () => {
    vi.useFakeTimers();
    const { stream } = createStream();
    const candidateSocket = {
      readyState: 0,
      bufferedAmount: 0,
      close: vi.fn(function close() {
        this.readyState = 3;
      }),
    };
    const onError = vi.fn();
    const { session, states } = createSession({
      mediaDevices: { getUserMedia: () => Promise.resolve(stream) },
      createWebSocket: () => candidateSocket,
      socketTimeoutMs: 1_000,
      onError,
    });

    await expect(session.start()).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(onError).toHaveBeenCalledOnce();
    expect(candidateSocket.close).toHaveBeenCalledWith(1011, 'error');
    expect(states.at(-1)).toEqual({ state: 'idle', reason: 'error' });
  });

  it('times out camera permission and rejects a late stream safely', async () => {
    vi.useFakeTimers();
    const camera = deferred();
    const { stream, track } = createStream();
    const onError = vi.fn();
    const { session, states } = createSession({
      mediaDevices: { getUserMedia: () => camera.promise },
      cameraTimeoutMs: 1_000,
      onError,
    });

    const startPromise = session.start();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(startPromise).resolves.toBe(false);

    camera.resolve(stream);
    await Promise.resolve();

    expect(onError).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(states.at(-1)).toEqual({ state: 'idle', reason: 'camera-error' });
  });
});
