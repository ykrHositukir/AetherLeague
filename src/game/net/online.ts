// ============================================================
// AETHER LEAGUE - オンライン通信 (socket.io アダプタ)
// プレゼンス / パーティ / デュエル / バトリレー (pid 付き)
// ============================================================

import { io, type Socket } from 'socket.io-client';
import type { GlowType, ProjShape, Team } from '../types';

// ------------------------------------------------------------
// 共通型
// ------------------------------------------------------------

export interface PlayerInfo {
  pid: string;
  name: string;
  charId: string;
  status: 'lobby' | 'party' | 'battle';
  /** パーティ内ボット (実プレイヤーでは無い・host が管理) */
  isBot?: boolean;
}

export interface NetPeer {
  pid: string;
  name: string;
  charId: string;
  side: Team;
  isBot?: boolean;
}

export interface PartyState {
  partyId: string;
  code: string;
  host: string;
  members: PlayerInfo[];
}

export interface DuelMatchInfo {
  roomId: string;
  side: Team;
  myPid: string;
  opp: PlayerInfo;
}

export interface PartyMatchInfo {
  roomId: string;
  mapId: string;
  side: Team;
  myPid: string;
  peers: NetPeer[];
}

// ------------------------------------------------------------
// バトル中のイベント
// ------------------------------------------------------------

export interface NetChampion {
  p: [number, number];
  f: number;
  hp: number;
  maxHp: number;
  lv: number;
  dead: boolean;
  anim: string;
}

export type NetEvent =
  | { t: 'dmg'; id: string; amt: number; kill?: boolean }
  | { t: 'champDmg'; pid: string; from: string; amt: number; stun?: number; cower?: number }
  | { t: 'champKill'; pid: string; from: string }
  | { t: 'fx'; kind: 'ring' | 'burst' | 'rage'; color: string; x: number; z: number; r?: number; n?: number; dur?: number; team?: 'blue' | 'red' }
  | { t: 'fx'; kind: 'bed'; x: number; z: number; rot: number; team: 'blue' | 'red' }
  | { t: 'ping'; text: string; team: 'blue' | 'red' }
  | { t: 'end'; winBlue: boolean };

export interface NetWorld {
  m: [string, number, number, number, boolean][];
  s: [string, number][];
  n: [number, number, number][];
  p: [string, number, number, number, number][];
  /** AI bot チャンピオン同期 (authority → clients): [pid, x, z, hp, maxHp, lv, dead, anim, facing] */
  c?: [string, number, number, number, number, number, boolean, string, number][];
  nx: [number, number];
}

export interface NetAdapter {
  isAuthority: boolean;
  side: Team;
  sendChampion(s: NetChampion): void;
  sendEvents(evs: NetEvent[]): void;
  sendWorld(snap: NetWorld): void;
  onChampion: (pid: string, s: NetChampion) => void;
  onEvents: (pid: string, evs: NetEvent[]) => void;
  onWorld: (snap: NetWorld) => void;
  onOppLeft?: (pid: string) => void;
}

// ------------------------------------------------------------
// 常駐クライアント (ロビー/パーティ/招待)
// ------------------------------------------------------------

interface GameClientHandlers {
  onConn: (ok: boolean) => void;
  onOnline: (players: PlayerInfo[]) => void;
  onParty: (p: PartyState | null) => void;
  onPartyInvite: (from: PlayerInfo, partyId: string) => void;
  onPartyDeclined: (name: string) => void;
  onPartyKicked: () => void;
  onPartyError: (msg: string) => void;
  onDuelInvite: (from: PlayerInfo) => void;
  onDuelDeclined: (name: string) => void;
  onDuelError: (msg: string) => void;
  onPartyStart: (info: PartyMatchInfo) => void;
  onDuelStart: (info: DuelMatchInfo) => void;
  onMatch: (info: DuelMatchInfo) => void;
}

export class GameClient {
  private socket: Socket | null = null;
  private lastName = '';
  private lastChar = '';
  pid = '';
  connected = false;

  onConn: (ok: boolean) => void = () => {};
  onOnline: (players: PlayerInfo[]) => void = () => {};
  onParty: (p: PartyState | null) => void = () => {};
  onPartyInvite: (from: PlayerInfo, partyId: string) => void = () => {};
  onPartyDeclined: (name: string) => void = () => {};
  onPartyKicked: () => void = () => {};
  onPartyError: (msg: string) => void = () => {};
  onDuelInvite: (from: PlayerInfo) => void = () => {};
  onDuelDeclined: (name: string) => void = () => {};
  onDuelError: (msg: string) => void = () => {};
  onPartyStart: (info: PartyMatchInfo) => void = () => {};
  onDuelStart: (info: DuelMatchInfo) => void = () => {};
  onMatch: (info: DuelMatchInfo) => void = () => {};

  /** 常駐接続を確立 (既に繋がっていれば再登録のみ) */
  connect(name: string, charId: string) {
    this.lastName = name;
    this.lastChar = charId;
    if (!this.socket) {
      this.socket = io('/?XTransformPort=3002', {
        path: '/',
        transports: ['websocket', 'polling'],
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1500,
        timeout: 8000,
      });
      this.wire(this.socket);
    }
    const s = this.socket;
    s.connect();
    // 接続済みなら即再登録 / 未接続なら connect 後に登録 (wire 内で再接続時も自動再登録)
    if (s.connected) s.emit('register', { name, charId });
  }

  private wire(s: Socket) {
    s.on('connect', () => {
      this.connected = true;
      this.pid = s.id ?? '';
      if (this.lastName) s.emit('register', { name: this.lastName, charId: this.lastChar });
      this.onConn(true);
    });
    s.on('disconnect', () => {
      this.connected = false;
      this.onConn(false);
    });
    s.on('registered', (d: { pid: string }) => {
      this.pid = d.pid;
      this.onConn(true);
    });
    s.on('online', (d: { players: PlayerInfo[] }) => this.onOnline(d.players));
    s.on('party', (p: PartyState) => this.onParty(p));
    s.on('party_invite', (d: { from: PlayerInfo; partyId: string }) => this.onPartyInvite(d.from, d.partyId));
    s.on('party_declined', (d: { name: string }) => this.onPartyDeclined(d.name));
    s.on('party_kicked', () => this.onPartyKicked());
    s.on('party_error', (d: { msg: string }) => this.onPartyError(d.msg));
    s.on('duel_invite', (d: { from: PlayerInfo }) => this.onDuelInvite(d.from));
    s.on('duel_declined', (d: { name: string }) => this.onDuelDeclined(d.name));
    s.on('duel_error', (d: { msg: string }) => this.onDuelError(d.msg));
    s.on('party_start', (info: PartyMatchInfo) => this.onPartyStart(info));
    s.on('duel_start', (info: DuelMatchInfo) => this.onDuelStart(info));
    s.on('match', (info: { roomId: string; side: Team; myPid: string; opp: PlayerInfo }) =>
      this.onMatch(info));
  }

  setNameChar(name: string, charId: string) {
    this.socket?.emit('set_char', { name, charId });
  }

  // --- パーティ ---
  createParty() { this.socket?.emit('party_create'); }
  /** パーティにボットを追加 (host のみ・パーティが無ければサーバ側で自動作成) */
  addPartyBot(name: string, charId: string) { this.socket?.emit('party_add_bot', { name, charId }); }
  inviteParty(to: string) { this.socket?.emit('party_invite', { to }); }
  acceptParty(partyId: string) { this.socket?.emit('party_accept', { partyId }); }
  declineParty(to: string) { this.socket?.emit('party_decline', { to }); }
  leaveParty() { this.socket?.emit('party_leave'); }
  kickParty(pid: string) { this.socket?.emit('party_kick', { pid }); }
  startParty(mapId: string, bots: NetPeer[]) { this.socket?.emit('party_start', { mapId, bots }); }

  // --- デュエル ---
  inviteDuel(to: string) { this.socket?.emit('duel_invite', { to }); }
  acceptDuel(from: string) { this.socket?.emit('duel_accept', { from }); }
  declineDuel(to: string) { this.socket?.emit('duel_decline', { to }); }

  // --- ランダムマッチ ---
  findMatch(charId: string, name: string) {
    this.socket?.emit('find', { charId, name });
  }
  cancelMatch() { this.socket?.emit('cancel'); }

  /** 試合終了後: ロビー (or パーティ) に戻る */
  back(to: 'lobby' | 'party') {
    this.socket?.emit('back', { to });
  }

  createBattleNet(roomId: string, side: Team): BattleNet {
    return new BattleNet(this.ensure(), roomId, side, this.pid);
  }

  private ensure(): Socket {
    if (!this.socket) {
      this.socket = io('/?XTransformPort=3002', { path: '/', transports: ['websocket', 'polling'] });
      this.wire(this.socket);
    }
    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
  }
}

// ------------------------------------------------------------
// バトル中の通信アダプタ (pid 付きリレー)
// ------------------------------------------------------------

export class BattleNet implements NetAdapter {
  isAuthority: boolean;
  side: Team;
  private socket: Socket;
  private roomId: string;
  private myPid: string;
  onChampion: (pid: string, s: NetChampion) => void = () => {};
  onEvents: (pid: string, evs: NetEvent[]) => void = () => {};
  onWorld: (snap: NetWorld) => void = () => {};
  onOppLeft?: (pid: string) => void;

  constructor(socket: Socket, roomId: string, side: Team, myPid: string) {
    this.socket = socket;
    this.roomId = roomId;
    this.side = side;
    this.myPid = myPid;
    this.isAuthority = side === 'blue';

    socket.on('c', (pid: string, s: NetChampion) => this.onChampion(pid, s));
    socket.on('e', (pid: string, evs: NetEvent[]) => this.onEvents(pid, evs));
    socket.on('w', (snap: NetWorld) => this.onWorld(snap));
    socket.on('opp_left', (d: { pid: string }) => this.onOppLeft?.(d.pid));
  }

  sendChampion(s: NetChampion) {
    this.socket.emit('c', this.roomId, this.myPid, s);
  }
  sendEvents(evs: NetEvent[]) {
    if (evs.length) this.socket.emit('e', this.roomId, this.myPid, evs);
  }
  sendWorld(snap: NetWorld) {
    this.socket.emit('w', this.roomId, snap);
  }
  dispose() {
    this.socket.off('c');
    this.socket.off('e');
    this.socket.off('w');
    this.socket.off('opp_left');
    this.socket.emit('leave', this.roomId);
  }
}
