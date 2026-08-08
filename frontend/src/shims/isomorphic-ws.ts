/**
 * Browser shim for `isomorphic-ws`.
 *
 * The indexer public-data provider imports `isomorphic-ws` and namespaces its
 * `WebSocket` binding (`ws.WebSocket`). In browsers that binding is undefined,
 * so we re-export `globalThis.WebSocket` under the same shape — the default
 * parameter is never used anyway, because we always pass the browser's
 * WebSocket explicitly to `indexerPublicDataProvider`.
 */
export const WebSocket = globalThis.WebSocket;
export default globalThis.WebSocket;