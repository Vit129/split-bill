// Two-device sync over WebRTC with copy-paste signalling: no app server.
// The only outside party is a public STUN server (to find each phone's address).
// Phones behind strict carrier NAT may fail to connect; there is no TURN relay here.
import { decodeSignal, encodeSignal } from '../logic/share-code.ts';
import type { Cells } from '../logic/cells.ts';

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
const CHANNEL = 'kaiten-sushi-cells';
const ICE_WAIT_MS = 6000;
const MAX_MESSAGE_CHARS = 500000;

export type SyncStatus = 'connected' | 'failed' | 'closed' | 'connecting' | 'waiting';

export interface SyncHooks {
  getCells: () => Cells;
  onCells: (cells: unknown) => void;
  onRejected: () => void;
  onStatus: (status: SyncStatus) => void;
}

export interface SyncSession {
  code: string;
  send: (cells: Cells) => void;
  close: () => void;
  acceptReply?: (replyCode: string) => Promise<void>;
}

export const isSupported = (): boolean => typeof RTCPeerConnection === 'function';

// Non-trickle ICE: wait until candidates are gathered so one code carries everything.
// If gathering is slow, use what we have rather than blocking forever.
function gatherIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = (): void => {
      if (pc.iceGatheringState === 'complete') finish();
    };
    const timer = setTimeout(finish, ICE_WAIT_MS);
    function finish(): void {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', done);
      resolve();
    }
    pc.addEventListener('icegatheringstatechange', done);
  });
}

// Wires a data channel: sends our cells on open and hands incoming messages to onCells.
function attachChannel(channel: RTCDataChannel, hooks: SyncHooks): { send: (cells: Cells) => void } {
  const send = (cells: Cells): void => {
    if (channel.readyState === 'open') channel.send(JSON.stringify({ cells }));
  };
  channel.onopen = () => {
    hooks.onStatus('connected');
    send(hooks.getCells());
  };
  channel.onclose = () => hooks.onStatus('closed');
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (typeof event.data !== 'string' || event.data.length > MAX_MESSAGE_CHARS) {
      hooks.onRejected();
      return;
    }
    let message: unknown;
    try {
      message = JSON.parse(event.data);
    } catch {
      hooks.onRejected();
      return;
    }
    hooks.onCells(typeof message === 'object' && message !== null ? (message as { cells?: unknown }).cells : undefined);
  };
  return { send };
}

function newPeer(hooks: SyncHooks): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') hooks.onStatus('failed');
  };
  return pc;
}

// Host: creates the invite code, later accepts the guest's reply code.
export async function createInvite(hooks: SyncHooks): Promise<SyncSession> {
  const pc = newPeer(hooks);
  const channel = pc.createDataChannel(CHANNEL);
  const link = attachChannel(channel, hooks);
  await pc.setLocalDescription(await pc.createOffer());
  await gatherIce(pc);
  const local = pc.localDescription;
  if (!local) throw new Error('NO_LOCAL_DESCRIPTION');
  return {
    code: encodeSignal(local),
    acceptReply: async (replyCode: string) => {
      const reply = decodeSignal(replyCode);
      if (reply.type !== 'answer') throw new Error('INVALID_CODE');
      await pc.setRemoteDescription(reply);
    },
    send: link.send,
    close: () => pc.close(),
  };
}

// Guest: takes the invite, returns the reply code to send back.
export async function joinWithInvite(inviteCode: unknown, hooks: SyncHooks): Promise<SyncSession> {
  const invite = decodeSignal(inviteCode);
  if (invite.type !== 'offer') throw new Error('INVALID_CODE');
  const pc = newPeer(hooks);
  let link: { send: (cells: Cells) => void } | null = null;
  pc.ondatachannel = (event: RTCDataChannelEvent) => {
    link = attachChannel(event.channel, hooks);
  };
  await pc.setRemoteDescription(invite);
  await pc.setLocalDescription(await pc.createAnswer());
  await gatherIce(pc);
  const local = pc.localDescription;
  if (!local) throw new Error('NO_LOCAL_DESCRIPTION');
  return {
    code: encodeSignal(local),
    send: (cells: Cells) => link?.send(cells),
    close: () => pc.close(),
  };
}
