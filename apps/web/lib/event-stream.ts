"use client";

type StreamListener = EventListener;

const STREAM_URL = "/api/events/stream";
const listeners = new Map<string, Set<StreamListener>>();

let source: EventSource | null = null;
let subscriberCount = 0;
let closeTimer: number | null = null;

function ensureSource() {
  if (typeof window === "undefined") {
    return null;
  }
  if (source) {
    return source;
  }

  source = new EventSource(STREAM_URL, { withCredentials: true });
  for (const [eventName, eventListeners] of listeners.entries()) {
    for (const listener of eventListeners) {
      source.addEventListener(eventName, listener);
    }
  }
  return source;
}

function addListener(eventName: string, listener: StreamListener) {
  const eventListeners = listeners.get(eventName) ?? new Set<StreamListener>();
  eventListeners.add(listener);
  listeners.set(eventName, eventListeners);
  source?.addEventListener(eventName, listener);
}

function removeListener(eventName: string, listener: StreamListener) {
  const eventListeners = listeners.get(eventName);
  if (!eventListeners) {
    return;
  }
  eventListeners.delete(listener);
  source?.removeEventListener(eventName, listener);
  if (eventListeners.size === 0) {
    listeners.delete(eventName);
  }
}

function scheduleCloseIfIdle() {
  if (closeTimer) {
    window.clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (subscriberCount > 0 || !source) {
    return;
  }
  closeTimer = window.setTimeout(() => {
    if (subscriberCount === 0) {
      source?.close();
      source = null;
    }
    closeTimer = null;
  }, 1000);
}

export function subscribeCloudDocEvents(
  eventNames: string[],
  listener: (event: MessageEvent<string>) => void,
  options: {
    onOpen?: () => void;
    onError?: () => void;
  } = {},
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (closeTimer) {
    window.clearTimeout(closeTimer);
    closeTimer = null;
  }

  subscriberCount += 1;
  const streamListener = listener as StreamListener;
  const openListener = options.onOpen ? (() => options.onOpen?.()) as StreamListener : null;
  const errorListener = options.onError ? (() => options.onError?.()) as StreamListener : null;

  for (const eventName of eventNames) {
    addListener(eventName, streamListener);
  }
  if (openListener) {
    addListener("open", openListener);
  }
  if (errorListener) {
    addListener("error", errorListener);
  }
  ensureSource();

  return () => {
    for (const eventName of eventNames) {
      removeListener(eventName, streamListener);
    }
    if (openListener) {
      removeListener("open", openListener);
    }
    if (errorListener) {
      removeListener("error", errorListener);
    }
    subscriberCount = Math.max(0, subscriberCount - 1);
    scheduleCloseIfIdle();
  };
}
