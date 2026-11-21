// Two-device sync over WebRTC with copy-paste signalling: no app server.
// The only outside party is a public STUN server (to find each phone's address).
// Phones behind strict carrier NAT may fail to connect; there is no TURN relay here.
import { decodeSignal, encodeSignal } from '../logic/share-code.js';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const CHANNEL = 'kaiten-sushi-cells';
const ICE_WAIT_MS = 6000;
const MAX_MESSAGE_CHARS = 500000;

export const isSupported = () => typeof RTCPeerConnection === 'function';

// Non-trickle ICE: wait until candidates are gathered so one code carries everything.
// If gathering is slow, use what we have rather than blocking forever.
function gatherIce(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => {
      if (pc.iceGatheringState === 'complete') finish();
    };
    const timer = setTimeout(finish, ICE_WAIT_MS);
    function finish() {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', done);
      resolve();
    }
    pc.addEventListener('icegatheringstatechange', done);
  });
}

// Wires a data channel: sends our cells on open and hands incoming messages to onCells.
function attachChannel(channel, hooks) {
  const send = (cells) => {
    if (channel.readyState === 'open') channel.send(JSON.stringify({ cells }));
  };
  channel.onopen = () => {
    hooks.onStatus('connected');
    send(hooks.getCells());
  };
  channel.onclose = () => hooks.onStatus('closed');
  channel.onmessage = (event) => {
    if (typeof event.data !== 'string' || event.data.length > MAX_MESSAGE_CHARS) {
      hooks.onRejected();
      return;
    }
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      hooks.onRejected();
      return;
    }
    hooks.onCells(message?.cells);
  };
  return { send };
}

function newPeer(hooks) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') hooks.onStatus('failed');
  };
  return pc;
}

// Host: creates the invite code, later accepts the guest's reply code.
export async function createInvite(hooks) {
  const pc = newPeer(hooks);
  const channel = pc.createDataChannel(CHANNEL);
  const link = attachChannel(channel, hooks);
  await pc.setLocalDescription(await pc.createOffer());
  await gatherIce(pc);
  return {
    code: encodeSignal(pc.localDescription),
    acceptReply: async (replyCode) => {
      const reply = decodeSignal(replyCode);
      if (reply.type !== 'answer') throw new Error('INVALID_CODE');
      await pc.setRemoteDescription(reply);
    },
    send: link.send,
    close: () => pc.close(),
  };
}

// Guest: takes the invite, returns the reply code to send back.
export async function joinWithInvite(inviteCode, hooks) {
  const invite = decodeSignal(inviteCode);
  if (invite.type !== 'offer') throw new Error('INVALID_CODE');
  const pc = newPeer(hooks);
  let link = null;
  pc.ondatachannel = (event) => {
    link = attachChannel(event.channel, hooks);
  };
  await pc.setRemoteDescription(invite);
  await pc.setLocalDescription(await pc.createAnswer());
  await gatherIce(pc);
  return {
    code: encodeSignal(pc.localDescription),
    send: (cells) => link?.send(cells),
    close: () => pc.close(),
  };
}
