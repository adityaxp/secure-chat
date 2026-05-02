/**
 * Minimal signaling relay + hash lookup for local development.
 *
 * Usage: node scripts/signaling-server.mjs
 * Env: PORT (default 8080)
 *
 * Protocol:
 * - Clients send JSON messages. On `register`, optional `profile.userHash` is indexed.
 * - `lookup-peer` { from, targetHash } → responds to sender with `peer-found` or `peer-not-found`.
 * - Messages with `to` are relayed to that client's socket if connected.
 */

import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT) || 8080;

/** @type {Map<string, import('ws').WebSocket>} */
const clientsById = new Map();
/** @type {Map<string, string>} normalizedHash -> userId */
const hashToUserId = new Map();
/** @type {Map<string, string>} userId -> normalizedHash */
const userIdToHash = new Map();

function normalizeHash(h) {
  let s = String(h ?? "")
    .replace(/^0x/i, "")
    .replace(/\s/g, "")
    .toLowerCase();
  if (/^\d+$/.test(s) && s.length >= 1 && s.length <= 3) {
    s = s.padStart(3, "0");
  }
  return s;
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  /** @type {string | undefined} */
  let clientId;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "register") {
      clientId = msg.from;
      clientsById.set(msg.from, ws);

      const prevHash = userIdToHash.get(msg.from);
      if (prevHash) {
        hashToUserId.delete(prevHash);
        userIdToHash.delete(msg.from);
      }

      const nh = normalizeHash(msg.profile?.userHash);
      if (nh) {
        hashToUserId.set(nh, msg.from);
        userIdToHash.set(msg.from, nh);
      }
      return;
    }

    if (msg.type === "lookup-peer") {
      const nh = normalizeHash(msg.targetHash);
      const peerId = hashToUserId.get(nh);
      const requester = clientsById.get(msg.from);
      if (!requester) return;

      if (peerId && clientsById.has(peerId) && peerId !== msg.from) {
        send(requester, {
          type: "peer-found",
          peerId,
          targetHash: nh,
        });
      } else {
        send(requester, { type: "peer-not-found", targetHash: nh });
      }
      return;
    }

    if (msg.to && clientsById.has(msg.to)) {
      const target = clientsById.get(msg.to);
      send(target, msg);
    }
  });

  ws.on("close", () => {
    if (!clientId) return;
    clientsById.delete(clientId);
    const nh = userIdToHash.get(clientId);
    if (nh) {
      hashToUserId.delete(nh);
      userIdToHash.delete(clientId);
    }
  });
});

console.log(`Signaling server listening on ws://0.0.0.0:${PORT}`);
