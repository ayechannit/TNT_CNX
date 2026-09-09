// Tiny pub/sub so a global loading indicator can reflect every in-flight
// API call without every page having to plumb its own loading state -
// api/client.js's single request() chokepoint calls begin/endRequest, and
// any number of UI listeners (just GlobalLoadingBar today) can subscribe.
let activeCount = 0;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(activeCount));
}

export function subscribeLoading(fn) {
  listeners.add(fn);
  fn(activeCount);
  return () => listeners.delete(fn);
}

export function beginRequest() {
  activeCount += 1;
  notify();
}

export function endRequest() {
  activeCount = Math.max(0, activeCount - 1);
  notify();
}
