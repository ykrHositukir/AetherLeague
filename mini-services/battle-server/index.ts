// ============================================================
// AETHER LEAGUE - オンラインサーバー (socket.io / port 3002)
// プレゼンス(オンライン一覧) + パーティ(招待/参加) + デュエル + 3v3開始 + リレー
// ============================================================

import { Server, type Socket } from 'socket.io';

const PORT = 3002;

// ------------------------------------------------------------
// 型
// ------------------------------------------------------------

export interface PlayerInfo {
  pid: string;              // パブリックID (socket.id)
  name: string;
  charId: string;
  status: 'lobby' | 'party' | 'battle';
}

export interface NetPeer {
  pid: string;
  name: string;
  charId: string;
  side: 'blue' | 'red';
  isBot?: boolean;
}

interface PartyBot {
  pid: string;              // bot:xxxx (実ソケット無し・ホストが管理)
  name: string;
  charId: string;
}

interface Party {
  id: string;
  code: string;
  host: string;             // pid
  members: string[];        // 人間 pids
  bots: PartyBot[];         // ホストが追加したボット (キック可・開始時に補完枠へ)
}

interface BattleRoom {
  id: string;
  peers: string[];          // pids
}

// ------------------------------------------------------------
// 状態
// ------------------------------------------------------------

const players = new Map<string, { info: PlayerInfo; partyId: string | null }>();
const parties = new Map<string, Party>();
const battleRooms = new Map<string, BattleRoom>();

const io = new Server(PORT, {
  cors: { origin: '*' },
  path: '/',   // ゲートウェイ経由 (XTransformPort) のパスに合わせる
  pingInterval: 20000,
  pingTimeout: 60000,   // 低スペック環境/バックグラウンドでも切断されないよう寛容に
});

// ------------------------------------------------------------
// ユーティリティ
// ------------------------------------------------------------

const rid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const pidOf = (s: Socket) => s.id;
const getInfo = (pid: string): PlayerInfo | null => players.get(pid)?.info ?? null;

function onlineList(): PlayerInfo[] {
  return Array.from(players.values()).map((p) => p.info);
}

function broadcastPresence() {
  io.emit('online', { players: onlineList() });
}

function partyMembersOf(partyId: string): PlayerInfo[] {
  const party = parties.get(partyId);
  if (!party) return [];
  return party.members.map((pid) => getInfo(pid)).filter((p): p is PlayerInfo => !!p);
}

function emitPartyState(party: Party) {
  const members: (PlayerInfo & { isBot?: boolean })[] = [
    ...partyMembersOf(party.id),
    ...party.bots.map((b) => ({ pid: b.pid, name: b.name, charId: b.charId, status: 'party' as const, isBot: true })),
  ];
  for (const pid of party.members) {
    io.to(pid).emit('party', {
      partyId: party.id,
      code: party.code,
      host: party.host,
      members,
    });
  }
}

function setStatus(pid: string, status: PlayerInfo['status']) {
  const p = players.get(pid);
  if (p) p.info.status = status;
  broadcastPresence();
}

function leaveParty(socket: Socket, silent = false) {
  const rec = players.get(pidOf(socket));
  if (!rec || !rec.partyId) return;
  const party = parties.get(rec.partyId);
  rec.partyId = null;
  if (rec.info.status === 'party') rec.info.status = 'lobby';
  if (party) {
    party.members = party.members.filter((m) => m !== pidOf(socket));
    if (party.members.length === 0) {
      parties.delete(party.id);
    } else {
      if (party.host === pidOf(socket)) party.host = party.members[0];
      emitPartyState(party);
    }
  }
  if (!silent) broadcastPresence();
}

function removeFromBattleRoom(pid: string) {
  for (const [roomId, room] of Array.from(battleRooms.entries())) {
    if (!room.peers.includes(pid)) continue;
    room.peers = room.peers.filter((p) => p !== pid);
    io.to(roomId).emit('opp_left', { pid });
    io.sockets.sockets.get(pid)?.leave(roomId);
    if (room.peers.length === 0) battleRooms.delete(roomId);
  }
}

/** socket.io 実room に参加させる (relay の socket.to(roomId) に必須) */
function joinBattleRoom(roomId: string, pids: string[]) {
  for (const pid of pids) {
    const s = io.sockets.sockets.get(pid);
    if (s) s.join(roomId);
  }
}

/** パーティ開始: side は blue/red 交互 (host が blue 先頭) */
function assignSides(pids: string[]): Map<string, 'blue' | 'red'> {
  const map = new Map<string, 'blue' | 'red'>();
  pids.forEach((pid, i) => map.set(pid, i % 2 === 0 ? 'blue' : 'red'));
  return map;
}

// ------------------------------------------------------------
// 接続
// ------------------------------------------------------------

io.on('connection', (socket) => {
  console.log(`[battle-server] connected: ${socket.id}`);

  // --- ロビー登録 (プレゼンス) ---
  socket.on('register', (data: { name: string; charId: string }) => {
    players.set(socket.id, {
      info: {
        pid: socket.id,
        name: (data?.name || 'Player').slice(0, 12),
        charId: data?.charId || 'blaze',
        status: 'lobby',
      },
      partyId: null,
    });
    socket.emit('registered', { pid: socket.id });
    broadcastPresence();
  });

  // --- キャラ/名前更新 ---
  socket.on('set_char', (data: { name?: string; charId?: string }) => {
    const rec = players.get(socket.id);
    if (!rec) return;
    if (data?.name) rec.info.name = data.name.slice(0, 12);
    if (data?.charId) rec.info.charId = data.charId;
    broadcastPresence();
    if (rec.partyId) {
      const party = parties.get(rec.partyId);
      if (party) emitPartyState(party);
    }
  });

  // --- パーティ作成 ---
  socket.on('party_create', () => {
    const rec = players.get(socket.id);
    if (!rec) return;
    if (rec.partyId) {
      socket.emit('party_error', { msg: 'すでにパーティに参加しています' });
      return;
    }
    const party: Party = {
      id: rid('p'),
      code: Math.random().toString(36).slice(2, 6).toUpperCase(),
      host: socket.id,
      members: [socket.id],
      bots: [],
    };
    parties.set(party.id, party);
    rec.partyId = party.id;
    rec.info.status = 'party';
    emitPartyState(party);
    broadcastPresence();
  });

  // --- パーティにボット追加 (host のみ・パーティが無ければ自動作成) ---
  socket.on('party_add_bot', (data: { name?: string; charId?: string }) => {
    const rec = players.get(socket.id);
    if (!rec) return;
    let party = rec.partyId ? parties.get(rec.partyId) : undefined;
    if (!party) {
      party = {
        id: rid('p'),
        code: Math.random().toString(36).slice(2, 6).toUpperCase(),
        host: socket.id,
        members: [socket.id],
        bots: [],
      };
      parties.set(party.id, party);
      rec.partyId = party.id;
      rec.info.status = 'party';
      broadcastPresence();
    }
    if (party.host !== socket.id) { socket.emit('party_error', { msg: 'ホストだけがボットを追加できます' }); return; }
    if (party.members.length + party.bots.length >= 6) { socket.emit('party_error', { msg: 'パーティが満員です (最大6人)' }); return; }
    const name = (data?.name || '').trim().slice(0, 12) || 'ボット';
    const bot: PartyBot = { pid: `bot:${rid('b')}`, name, charId: data?.charId || 'blaze' };
    party.bots.push(bot);
    emitPartyState(party);
    console.log(`[battle-server] party_add_bot: ${name} (${bot.charId}) → ${party.id} [bots:${party.bots.length}]`);
  });

  // --- パーティ招待 ---
  socket.on('party_invite', (data: { to: string; partyId?: string }) => {
    const from = getInfo(socket.id);
    if (!from) return;
    const target = players.get(data?.to);
    if (!target) { socket.emit('party_error', { msg: '相手が見つかりません' }); return; }
    if (target.info.status !== 'lobby') { socket.emit('party_error', { msg: '相手は現在招待できません' }); return; }
    let partyId = data?.partyId;
    if (!partyId) {
      // 自分のパーティが無ければ自動作成
      const rec = players.get(socket.id)!;
      if (rec.partyId) partyId = rec.partyId;
      else {
        const party: Party = { id: rid('p'), code: Math.random().toString(36).slice(2, 6).toUpperCase(), host: socket.id, members: [socket.id], bots: [] };
        parties.set(party.id, party);
        rec.partyId = party.id;
        rec.info.status = 'party';
        emitPartyState(party);
        broadcastPresence();
        partyId = party.id;
      }
    }
    const party = parties.get(partyId);
    if (!party || !party.members.includes(socket.id)) { socket.emit('party_error', { msg: 'パーティが存在しません' }); return; }
    if (party.members.length >= 3) { socket.emit('party_error', { msg: 'パーティが満員です (最大3人)' }); return; }
    if (party.members.includes(data.to)) return;
    io.to(data.to).emit('party_invite', { from, partyId });
  });

  // --- パーティ参加 ---
  socket.on('party_accept', (data: { partyId: string }) => {
    const rec = players.get(socket.id);
    const party = parties.get(data?.partyId);
    if (!rec || !party) { socket.emit('party_error', { msg: 'パーティが解散されました' }); return; }
    if (party.members.length >= 3) { socket.emit('party_error', { msg: 'パーティが満員です' }); return; }
    if (!party.members.includes(socket.id)) party.members.push(socket.id);
    rec.partyId = party.id;
    rec.info.status = 'party';
    leavePartyIfInOther(socket, party.id);
    emitPartyState(party);
    broadcastPresence();
  });

  function leavePartyIfInOther(socket: Socket, keepId: string) {
    const rec = players.get(socket.id);
    if (rec && rec.partyId && rec.partyId !== keepId) leaveParty(socket, true);
  }

  // --- パーティ辞退 ---
  socket.on('party_decline', (data: { to: string; partyId?: string }) => {
    const me = getInfo(socket.id);
    if (me) io.to(data?.to).emit('party_declined', { name: me.name });
  });

  // --- パーティ退出 ---
  socket.on('party_leave', () => {
    leaveParty(socket);
  });

  // --- パーティ追放 (人間 / ボット両対応) ---
  socket.on('party_kick', (data: { pid: string }) => {
    const rec = players.get(socket.id);
    if (!rec?.partyId) return;
    const party = parties.get(rec.partyId);
    if (!party || party.host !== socket.id) return;
    if (!data?.pid || data.pid === socket.id) return;
    if (party.members.includes(data.pid)) {
      party.members = party.members.filter((m) => m !== data.pid);
      const kicked = players.get(data.pid);
      if (kicked) {
        kicked.partyId = null;
        kicked.info.status = 'lobby';
        io.to(data.pid).emit('party_kicked');
      }
      emitPartyState(party);
      broadcastPresence();
      console.log(`[battle-server] party_kick: ${getInfo(data.pid)?.name ?? data.pid} ← ${party.id}`);
    } else if (party.bots.some((b) => b.pid === data.pid)) {
      const bn = party.bots.find((b) => b.pid === data.pid);
      party.bots = party.bots.filter((b) => b.pid !== data.pid);
      emitPartyState(party);
      console.log(`[battle-server] party_kick bot: ${bn?.name ?? data.pid} ← ${party.id}`);
    }
  });

  // --- デュエル招待 (1v1) ---
  socket.on('duel_invite', (data: { to: string }) => {
    const from = getInfo(socket.id);
    if (!from) return;
    const target = players.get(data?.to);
    if (!target || target.info.status === 'battle') { socket.emit('duel_error', { msg: '相手は現在招待できません' }); return; }
    io.to(data.to).emit('duel_invite', { from });
  });

  socket.on('duel_decline', (data: { to: string }) => {
    const me = getInfo(socket.id);
    if (me) io.to(data?.to).emit('duel_declined', { name: me.name });
  });

  // --- デュエル開始 (1v1部屋) ---
  socket.on('duel_accept', (data: { from: string }) => {
    const a = players.get(data?.from);
    const b = players.get(socket.id);
    if (!a || !b) { socket.emit('duel_error', { msg: '相手が接続していません' }); return; }
    const roomId = rid('r');
    battleRooms.set(roomId, { id: roomId, peers: [a.info.pid, b.info.pid] });
    joinBattleRoom(roomId, [a.info.pid, b.info.pid]);
    a.info.status = 'battle';
    b.info.status = 'battle';
    io.to(a.info.pid).emit('duel_start', { roomId, side: 'blue', myPid: a.info.pid, opp: b.info });
    io.to(b.info.pid).emit('duel_start', { roomId, side: 'red', myPid: b.info.pid, opp: a.info });
    broadcastPresence();
    console.log(`[battle-server] duel: ${a.info.name} vs ${b.info.name} (${roomId})`);
  });

  // --- パーティ開始 (3v3部屋) host のみ ---
  socket.on('party_start', (data: { mapId?: string }) => {
    const rec = players.get(socket.id);
    if (!rec?.partyId) return;
    const party = parties.get(rec.partyId);
    if (!party || party.host !== socket.id) return;
    const pids = [...party.members];
    const sides = assignSides(pids);
    const roomId = rid('r');
    const battlePeers: NetPeer[] = [];
    for (const pid of pids) {
      const info = getInfo(pid);
      if (!info) continue;
      battlePeers.push({ pid, name: info.name, charId: info.charId, side: sides.get(pid) ?? 'blue' });
    }
    // 不足スロット (合計6 - 人間) を bot で埋める: charId は host が決定済みで渡ってくる
    const bots: NetPeer[] = (data as { bots?: NetPeer[] }).bots ?? [];
    const allPeers = [...battlePeers, ...bots.filter((b) => b && b.pid)];
    battleRooms.set(roomId, { id: roomId, peers: pids });
    joinBattleRoom(roomId, pids);
    for (const pid of pids) {
      const me = getInfo(pid);
      if (!me) continue;
      const mySide = sides.get(pid) ?? 'blue';
      io.to(pid).emit('party_start', {
        roomId,
        mapId: data?.mapId || 'battlefield',
        side: mySide,
        myPid: pid,
        peers: allPeers,
      });
      players.get(pid)!.info.status = 'battle';
    }
    // パーティは維持 (試合後も同じメンバーで戻れる) ・ presence 更新のみ
    broadcastPresence();
    console.log(`[battle-server] party_start: ${pids.map((p) => getInfo(p)?.name).join(', ')} (${roomId})`);
  });

  // --- 試合終了後: ロビーへ戻る ---
  socket.on('back', (data: { to: 'lobby' | 'party' }) => {
    const rec = players.get(socket.id);
    if (!rec) return;
    removeFromBattleRoom(socket.id);
    if (data?.to === 'party' && rec.partyId && parties.has(rec.partyId)) {
      rec.info.status = 'party';
    } else {
      if (rec.partyId) leaveParty(socket, true);
      rec.info.status = 'lobby';
    }
    broadcastPresence();
  });

  // --- ランダムマッチ (オンライン1v1Ranked) ---
  socket.on('find', (data: { charId: string; name: string }) => {
    const rec = players.get(socket.id);
    if (rec) {
      rec.info.charId = data?.charId || rec.info.charId;
      rec.info.name = (data?.name || rec.info.name).slice(0, 12);
    }
    const me: Waiting = { socketId: socket.id, charId: data?.charId ?? 'blaze', name: data?.name ?? 'Player', at: Date.now() };
    const idx = queue.findIndex((w) => w.socketId === socket.id);
    if (idx >= 0) queue.splice(idx, 1);
    queue.push(me);
    if (queue.length >= 2) {
      const a = queue.shift()!;
      const b = queue.shift()!;
      const roomId = rid('r');
      battleRooms.set(roomId, { id: roomId, peers: [a.socketId, b.socketId] });
      joinBattleRoom(roomId, [a.socketId, b.socketId]);
      const aInfo = getInfo(a.socketId);
      const bInfo = getInfo(b.socketId);
      io.to(a.socketId).emit('match', {
        roomId, side: 'blue', myPid: a.socketId,
        opp: bInfo ?? { pid: b.socketId, name: b.name, charId: b.charId, status: 'battle' as const },
      });
      io.to(b.socketId).emit('match', {
        roomId, side: 'red', myPid: b.socketId,
        opp: aInfo ?? { pid: a.socketId, name: a.name, charId: a.charId, status: 'battle' as const },
      });
      broadcastPresence();
      console.log(`[battle-server] match: ${a.name} vs ${b.name} (${roomId})`);
    }
  });

  socket.on('cancel', () => {
    const idx = queue.findIndex((w) => w.socketId === socket.id);
    if (idx >= 0) queue.splice(idx, 1);
  });

  // --- バトリレー (pid 付き) ---
  socket.on('c', (roomId: string, pid: string, state: unknown) => {
    const room = battleRooms.get(roomId);
    if (!room || !room.peers.includes(socket.id)) return;
    socket.to(roomId).emit('c', pid, state);
  });
  socket.on('e', (roomId: string, pid: string, evs: unknown) => {
    const room = battleRooms.get(roomId);
    if (!room || !room.peers.includes(socket.id)) return;
    socket.to(roomId).emit('e', pid, evs);
  });
  socket.on('w', (roomId: string, snap: unknown) => {
    const room = battleRooms.get(roomId);
    if (!room || !room.peers.includes(socket.id)) return;
    socket.to(roomId).emit('w', snap);
  });

  socket.on('leave', (roomId: string) => {
    socket.to(roomId).emit('opp_left', { pid: socket.id });
    const room = battleRooms.get(roomId);
    if (room) {
      room.peers = room.peers.filter((p) => p !== socket.id);
      if (room.peers.length === 0) battleRooms.delete(roomId);
    }
  });

  // --- 切断: 全部掃除 ---
  socket.on('disconnect', () => {
    console.log(`[battle-server] disconnected: ${socket.id}`);
    const qi = queue.findIndex((w) => w.socketId === socket.id);
    if (qi >= 0) queue.splice(qi, 1);
    removeFromBattleRoom(socket.id);
    leaveParty(socket, true);
    players.delete(socket.id);
    broadcastPresence();
  });
});

interface Waiting {
  socketId: string;
  charId: string;
  name: string;
  at: number;
}

const queue: Waiting[] = [];

// 古い待機キューの掃除
setInterval(() => {
  const now = Date.now();
  for (let i = queue.length - 1; i >= 0; i--) {
    if (now - queue[i].at > 60000) queue.splice(i, 1);
  }
}, 30000);

console.log(`[battle-server] listening on :${PORT}`);
