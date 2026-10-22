// ============================================================
// AETHER LEAGUE - マップ3D構築
// 朝日の空・地形・3レーン道路・川・装飾(発光/アニメ)・草むら・タワー・ネクサス
// ============================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapDef, Team } from '../types';
import { LANE_SAMPLES, RIVER_SAMPLES, ALL_ROAD_POINTS, riverPoint, STATION_RAIL, RAIL_LEN, railPoint } from '../maps';
import type { GraphicsTier } from '../types';

export interface WorldRefs {
  group: THREE.Group;
  animated: ((t: number, dt: number) => void)[];
  bushMeshes: THREE.Group[];
  dispose: () => void;
}

const M = (c: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...opts });
const G = (c: number, i = 1.6) =>
  new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.35 });

// ------------------------------------------------------------
// 静的ジオメトリのバッチ化 (描画呼び出し削減・見た目は完全に同一)
// 同じマテリアルの小メッシュを1つのメッシュに統合する
// ------------------------------------------------------------

class GeoBatch {
  private parts: THREE.BufferGeometry[] = [];
  /** geo をバッチへ追加 (所有権はバッチへ。以後 geo を再利用しない) */
  add(geo: THREE.BufferGeometry) {
    if (this.parts.length < 4000) this.parts.push(geo);
    else geo.dispose();
  }
  /** 統合して1メッシュを返す (空なら null)。行列は静的 (自動更新オフ) */
  build(mat: THREE.Material, cast = false, receive = false): THREE.Mesh | null {
    if (!this.parts.length) return null;
    const merged = this.parts.length === 1 ? this.parts[0] : mergeGeometries(this.parts, false)!;
    if (this.parts.length > 1) for (const g of this.parts) g.dispose();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }
  get count() { return this.parts.length; }
}
/** クローンを作って変換してからバッチへ追加するヘルパ */
function batchAdd(batch: GeoBatch, base: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  const g = base.clone();
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  batch.add(g);
}

// ------------------------------------------------------------
// リボン (道路/川) ジオメトリ生成
// ------------------------------------------------------------

function ribbonGeometry(
  samples: { x: number; z: number }[],
  halfWidth: number,
  y: number,
  offset = 0
): THREE.BufferGeometry {
  const n = samples.length;
  const positions = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = samples[i];
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(n - 1, i + 1)];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    const nx = tz;
    const nz = -tx;
    const cx = p.x + nx * offset;
    const cz = p.z + nz * offset;
    positions[(i * 2) * 3 + 0] = cx + nx * halfWidth;
    positions[(i * 2) * 3 + 1] = y;
    positions[(i * 2) * 3 + 2] = cz + nz * halfWidth;
    positions[(i * 2 + 1) * 3 + 0] = cx - nx * halfWidth;
    positions[(i * 2 + 1) * 3 + 1] = y;
    positions[(i * 2 + 1) * 3 + 2] = cz - nz * halfWidth;
    uvs[(i * 2) * 2 + 0] = 0;
    uvs[(i * 2) * 2 + 1] = i / (n - 1);
    uvs[(i * 2 + 1) * 2 + 0] = 1;
    uvs[(i * 2 + 1) * 2 + 1] = i / (n - 1);
    if (i < n - 1) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ------------------------------------------------------------
// 空 (朝焼け + 太陽 + 雲)
// ------------------------------------------------------------

function buildSky(def: MapDef): { mesh: THREE.Mesh; mat: THREE.ShaderMaterial } {
  const geo = new THREE.SphereGeometry(300, 32, 22);
  const sunDir = new THREE.Vector3(def.sunDir[0], def.sunDir[1], def.sunDir[2]).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(def.skyTop) },
      bottom: { value: new THREE.Color(def.skyBottom) },
      horizon: { value: new THREE.Color(def.skyHorizon) },
      sunDir: { value: sunDir },
      sunColor: { value: new THREE.Color(def.sunColor) },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top; uniform vec3 bottom; uniform vec3 horizon;
      uniform vec3 sunDir; uniform vec3 sunColor;
      uniform float time;
      varying vec3 vPos;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        float a = hash(i);
        float b = hash(i+vec2(1.0,0.0));
        float c = hash(i+vec2(0.0,1.0));
        float d = hash(i+vec2(1.0,1.0));
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      void main() {
        vec3 dir = normalize(vPos);
        float h = dir.y;
        vec3 col = h > 0.0
          ? mix(horizon, top, pow(min(h*1.55, 1.0), 0.72))
          : mix(horizon, bottom, pow(min(-h*2.2, 1.0), 0.8));
        // 太陽ディスク + グロー
        float sd = max(dot(dir, sunDir), 0.0);
        col += sunColor * (pow(sd, 1400.0) * 2.2 + pow(sd, 90.0) * 0.55 + pow(sd, 9.0) * 0.22 + pow(sd, 2.5) * 0.08);
        // 朝焼けの地平線バンド
        float band = exp(-abs(h) * 14.0);
        col += sunColor * band * 0.16;
        // 朝の雲
        if (h > 0.02) {
          vec2 cp = dir.xz / max(dir.y, 0.07) * 0.5;
          cp.x += time * 0.006;
          float n1 = vnoise(cp * 1.8);
          float n2 = vnoise(cp * 3.6 + 7.3);
          float cl = smoothstep(0.52, 0.82, n1 * 0.62 + n2 * 0.38);
          float fade = smoothstep(0.02, 0.16, h) * (1.0 - smoothstep(0.5, 0.9, h));
          float sunSide = 0.6 + 0.4 * max(dot(normalize(dir), sunDir), 0.0);
          vec3 cloudCol = mix(vec3(1.02, 0.97, 0.92), sunColor * 1.05, sunSide * 0.45);
          col = mix(col, cloudCol, cl * fade * 0.5);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, mat };
}

// ------------------------------------------------------------
// 装飾
// ------------------------------------------------------------

function addDecor(w: WorldRefs, d: import('../types').DecorDef, def: MapDef, gfx: GraphicsTier) {
  const g = new THREE.Group();
  g.position.set(d.x, 0, d.z);
  const s = d.s ?? 1;
  g.scale.setScalar(s);
  g.rotation.y = d.r ?? 0;
  // アルティメット: 草木のポリゴン数を大幅増強 (低スペックでは据え置き)
  const poly = gfx === 'ultimate' ? 2 : gfx === 'ultra' ? 1.5 : 1;

  switch (d.kind) {
    case 'palm': {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 5.2, Math.round(7 * poly)), M(0x8a6a48));
      trunk.position.y = 2.6;
      trunk.castShadow = true;
      g.add(trunk);
      const leaves = Math.round(6 * poly);
      for (let i = 0; i < leaves; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.8, Math.round(4 * poly)), M(0x3cae5c, { roughness: 0.8 }));
        const a = (i / leaves) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 1.15, 5.2, Math.sin(a) * 1.15);
        leaf.rotation.set(Math.cos(a) * 1.25 + 0.4, -a, Math.sin(a) * -1.25);
        g.add(leaf);
      }
      const coconuts = new THREE.Mesh(new THREE.SphereGeometry(0.18, Math.round(8 * poly), Math.round(8 * poly)), M(0x6a4a2a));
      coconuts.position.y = 5.0;
      g.add(coconuts);
      w.animated.push((t) => {
        g.rotation.z = Math.sin(t * 1.1 + d.x) * 0.035;
      });
      break;
    }
    case 'umbrella': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), M(0xd8d0c0));
      pole.position.y = 1.3;
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.75, 10), M(d.x > 0 ? 0xff6a7a : 0x4fd1ff, { roughness: 0.6 }));
      top.position.y = 2.6;
      top.castShadow = true;
      g.add(pole, top);
      w.animated.push((t) => {
        top.rotation.y = t * 0.3;
      });
      break;
    }
    case 'float': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.34, 10, 20), M(0xffe14d, { roughness: 0.5 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.5;
      g.add(ring);
      w.animated.push((t) => {
        ring.position.y = 0.5 + Math.sin(t * 2 + d.z) * 0.08;
        ring.rotation.z = t * 0.4;
      });
      break;
    }
    case 'coral': {
      const mat = G(0xff5c9d, 1.2);
      for (let i = 0; i < 5; i++) {
        const branch = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.4, 5), mat);
        branch.position.set(Math.sin(i * 2.4) * 0.4, 0.65, Math.cos(i * 2.4) * 0.4);
        branch.rotation.set(Math.sin(i) * 0.4, i, Math.cos(i) * 0.4);
        g.add(branch);
      }
      w.animated.push((t) => {
        mat.emissiveIntensity = 1.0 + Math.sin(t * 2.2 + d.x) * 0.5;
      });
      break;
    }
    case 'torch': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), M(0x5a4632));
      pole.position.y = 1.1;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), G(0xffa02e, 2.4));
      flame.position.y = 2.5;
      g.add(pole, flame);
      // 擬似ライト (加算スプライト) — 本物のライトから置換して軽量化
      const glow = makeGlowSprite(0xff8a2e, 0.13, 7);
      glow.position.y = 0.07;
      g.add(glow);
      w.animated.push((t) => {
        flame.scale.y = 1 + Math.sin(t * 9 + d.x) * 0.22;
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.115 + Math.sin(t * 11 + d.z) * 0.032;
      });
      break;
    }
    case 'campfire': {
      for (let i = 0; i < 5; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 6), M(0x4a3420));
        log.rotation.z = Math.PI / 2.4;
        log.rotation.y = (i / 5) * Math.PI * 2;
        log.position.y = 0.12;
        g.add(log);
      }
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 7), G(0xff6a2e, 2.6));
      flame.position.y = 0.7;
      const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 6), G(0xffd02e, 2.8));
      flame2.position.y = 0.85;
      g.add(flame, flame2);
      // 擬似ライト (加算スプライト) — 本物のライトから置換して軽量化
      const glow = makeGlowSprite(0xff7a2e, 0.2, 9);
      glow.position.y = 0.07;
      g.add(glow);
      w.animated.push((t) => {
        flame.scale.y = 1 + Math.sin(t * 8) * 0.2;
        flame2.scale.y = 1 + Math.sin(t * 10 + 1) * 0.25;
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.183 + Math.sin(t * 9) * 0.05;
      });
      break;
    }
    case 'banner': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6), M(0x3a3040));
      pole.position.y = 1.7;
      const clothMat = M(d.x < 0 ? 0x2a5cff : 0xff3a4a, { side: THREE.DoubleSide, roughness: 0.8 });
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.7, 6, 8), clothMat);
      cloth.position.set(0.52, 2.45, 0);
      const emblem = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 14), G(d.x < 0 ? 0x6aa8ff : 0xff8a8a, 1.6));
      emblem.position.set(0.52, 2.45, 0.021);
      g.add(pole, cloth, emblem);
      w.animated.push((t) => {
        const geo = cloth.geometry as THREE.PlaneGeometry;
        const pos = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          pos.setZ(i, Math.sin(t * 3 + x * 3 + d.x) * 0.09 * (x + 0.5));
        }
        pos.needsUpdate = true;
      });
      break;
    }
    case 'crystal': {
      const mat = G(def.id === 'battlefield' ? 0x8a6cff : 0x4fd1ff, 1.8);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.85), mat);
      core.position.y = 2.1;
      core.castShadow = true;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.5, 7), M(0x3a3a50));
      base.position.y = 0.25;
      g.add(core, base);
      // 擬似ライト (加算スプライト) — 本物のライトから置換して軽量化
      const glow = makeGlowSprite(def.id === 'battlefield' ? 0x8a6cff : 0x4fd1ff, 0.1, 7.7);
      glow.position.y = 0.07;
      g.add(glow);
      w.animated.push((t) => {
        core.rotation.y = t * 0.8;
        core.position.y = 2.1 + Math.sin(t * 1.6) * 0.16;
        mat.emissiveIntensity = 1.6 + Math.sin(t * 2.4) * 0.6;
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.088 + Math.sin(t * 2.4) * 0.026;
      });
      break;
    }
    case 'pillar': {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 4.6, 10), M(0x6a6478));
      col.position.y = 2.3;
      col.castShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), M(0x78728c));
      cap.position.y = 4.75;
      const rune = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 6, 16), G(0xffc88a, 1.5));
      rune.position.y = 3.4;
      rune.rotation.x = Math.PI / 2;
      g.add(col, cap, rune);
      w.animated.push((t) => {
        rune.rotation.z = t * 0.7;
        rune.scale.setScalar(1 + Math.sin(t * 2) * 0.06);
      });
      break;
    }
    case 'tower-ruin': {
      const wallMat = M(0x6a5f6e, { roughness: 0.9 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 1.0), wallMat);
      base.position.y = 1.1;
      const broken = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.8, 1.0), wallMat);
      broken.position.set(-0.7, 1.9, 0);
      broken.rotation.z = 0.06;
      const moss = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.05), G(0x4dff88, 0.5));
      moss.position.set(0.8, 0.5, 0);
      g.add(base, broken, moss);
      break;
    }
    case 'rock': {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), M(def.id === 'battlefield' ? 0x5c5868 : 0x9a9484, { roughness: 0.95 }));
      r.position.y = 0.6;
      r.rotation.set(d.x, d.z, 0.2);
      r.castShadow = true;
      g.add(r);
      break;
    }
    case 'rubble': {
      for (let i = 0; i < 4; i++) {
        const piece = new THREE.Mesh(new THREE.BoxGeometry(0.5 + (i % 2) * 0.3, 0.4, 0.6), M(0x5c5464));
        piece.position.set(Math.sin(i * 2.7) * 0.8, 0.2, Math.cos(i * 2.7) * 0.8);
        piece.rotation.y = i * 1.3;
        g.add(piece);
      }
      break;
    }
    case 'lantern': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.8, 6), M(0x3a3444));
      pole.position.y = 0.9;
      const lampMat = G(def.id === 'battlefield' ? 0xffd89a : 0xffd86a, 2.2);
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), lampMat);
      lamp.position.y = 1.95;
      g.add(pole, lamp);
      // 擬似ライト (加算スプライト) — 本物のライトから置換して軽量化
      const glow = makeGlowSprite(def.id === 'battlefield' ? 0xffc86a : 0xffcf6a, 0.083, 5.5);
      glow.position.y = 0.07;
      g.add(glow);
      w.animated.push((t) => {
        lamp.rotation.y = t;
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.075 + Math.sin(t * 3 + d.z) * 0.02;
      });
      break;
    }
    case 'beachball': {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), M(0xff6a7a));
      ball.position.y = 0.4;
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.1, 8, 20), M(0xffe14d));
      stripe.position.y = 0.4;
      stripe.rotation.x = Math.PI / 2.5;
      g.add(ball, stripe);
      w.animated.push((t) => {
        ball.position.y = 0.4 + Math.abs(Math.sin(t * 2 + d.x)) * 0.25;
        stripe.rotation.z = t * 2;
      });
      break;
    }
    case 'sign': {
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.1), M(0x8a6a48));
      board.position.y = 1.5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), M(0x6a5238));
      pole.position.y = 0.8;
      g.add(board, pole);
      break;
    }
    // ---- 戦場: エーテルの欠片 (浮遊結晶) ----
    case 'shard': {
      const mat = G(0x9a7aff, 2.0);
      for (let i = 0; i < 3; i++) {
        const sh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.34 + i * 0.14), mat);
        sh.position.set(Math.sin(i * 2.1) * 0.5, 1.4 + i * 0.55, Math.cos(i * 2.1) * 0.5);
        sh.rotation.set(i, i * 2, i);
        g.add(sh);
        w.animated.push((t) => {
          sh.rotation.y = t * (0.7 + i * 0.3) + i;
          sh.position.y = 1.4 + i * 0.55 + Math.sin(t * 1.4 + i * 1.7) * 0.18;
        });
      }
      break;
    }
    // ---- リゾート: 踩っているカニ ----
    case 'crab': {
      const bodyM = M(0xff5c4d, { roughness: 0.55 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), bodyM);
      body.position.y = 0.3;
      body.scale.set(1.25, 0.75, 1);
      g.add(body);
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), M(0xffffff));
        eye.position.set(side * 0.1, 0.5, 0.24);
        g.add(eye);
        const claw = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), bodyM);
        claw.position.set(side * 0.42, 0.28, 0.14);
        claw.scale.set(1, 0.7, 1.3);
        g.add(claw);
      }
      w.animated.push((t) => {
        const a = t * 0.7 + d.x;
        g.position.x = d.x + Math.cos(a) * 2.2;
        g.position.z = d.z + Math.sin(a) * 2.2;
        g.rotation.y = -a + Math.PI / 2;
      });
      break;
    }
    // ---- リゾート: 砂に刺さったサーフボード ----
    case 'surf': {
      const board = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), M(0x4fd8b0, { roughness: 0.45 }));
      board.scale.set(0.42, 2.5, 1);
      board.position.y = 0.9;
      board.rotation.z = 0.5;
      board.castShadow = true;
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 16), G(0xffd86a, 1.2));
      stripe.rotation.x = Math.PI / 2.3;
      stripe.position.y = 1.5;
      g.add(board, stripe);
      break;
    }
    // ---- ステーション: 駅のプラットフォーム (屋根+安全線) ----
    case 'platform': {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(13, 0.7, 4.6), M(0x6a6678, { roughness: 0.9 }));
      slab.position.y = 0.35;
      slab.receiveShadow = true;
      slab.castShadow = true;
      const line = new THREE.Mesh(new THREE.BoxGeometry(13, 0.05, 0.4), G(0xffd84d, 0.8));
      line.position.set(0, 0.72, -1.6);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(11, 0.16, 3.4), M(0x3a3a52, { roughness: 0.7 }));
      roof.position.y = 3.4;
      roof.castShadow = true;
      g.add(slab, line, roof);
      for (const px of [-4.4, 0, 4.4]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 6), M(0x4a4a60));
        post.position.set(px, 1.7, 1.2);
        g.add(post);
      }
      const lampMat = G(0xfff0c0, 2.0);
      for (const px of [-3.6, 3.6]) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), lampMat);
        lamp.position.set(px, 3.25, 0.4);
        g.add(lamp);
      }
      const pl = makeGlowSprite(0xffe0a0, 0.13, 8.8);
      pl.position.set(0, 0.08, 0);
      g.add(pl);
      w.animated.push((t) => {
        (pl.material as THREE.MeshBasicMaterial).opacity = 0.115 + Math.sin(t * 1.8) * 0.023;
      });
      break;
    }
    // ---- ステーション: 踏切 (X標識 + 警報灯) ----
    case 'crossgate': {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 6), M(0xd8d4cc));
      post.position.y = 1.4;
      const x1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 0.1), M(0xffffff));
      x1.position.y = 2.5;
      x1.rotation.z = 0.7;
      const x2 = x1.clone();
      x2.rotation.z = -0.7;
      const alarm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), G(0xff3a4a, 2.4));
      alarm.position.y = 3.1;
      g.add(post, x1, x2, alarm);
      // 擬似ライト (加算スプライト) — 本物のライトから置換して軽量化
      const glow = makeGlowSprite(0xff3a4a, 0.067, 5.5);
      glow.position.y = 0.07;
      g.add(glow);
      w.animated.push((t) => {
        const f = 0.5 + Math.sin(t * 6) * 0.5;
        alarm.material.emissiveIntensity = 0.6 + f * 2.6;
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.017 + f * 0.083;
      });
      break;
    }
    // ---- ステーション: 駅信号機 ----
    case 'signal': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.2, 6), M(0x2a2a3a));
      pole.position.y = 1.6;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.1, 0.3), M(0x1a1a28));
      head.position.y = 2.8;
      const rMat = G(0xff3a4a, 1.2);
      const gMat = G(0x3aff7a, 0.35);
      const rl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), rMat);
      rl.position.set(0, 3.1, 0.16);
      const gl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), gMat);
      gl.position.set(0, 2.55, 0.16);
      g.add(pole, head, rl, gl);
      w.animated.push((t) => {
        const green = Math.sin(t * 0.5) > 0;
        rMat.emissiveIntensity = green ? 0.3 : 2.4;
        gMat.emissiveIntensity = green ? 2.4 : 0.3;
      });
      break;
    }
    // ---- ステーション: ベンチ ----
    case 'bench': {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), M(0x8a6a48, { roughness: 0.8 }));
      seat.position.y = 0.5;
      seat.castShadow = true;
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.1), M(0x8a6a48, { roughness: 0.8 }));
      back.position.set(0, 0.85, -0.26);
      for (const px of [-0.9, 0.9]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.55), M(0x3a3a4a));
        leg.position.set(px, 0.25, 0);
        g.add(leg);
      }
      g.add(seat, back);
      break;
    }
    // ---- ステーション: 駅名標 ----
    case 'billboard': {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 0.12), M(0xf0ead8, { roughness: 0.5 }));
      panel.position.y = 2.4;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 0.14), G(0x4fd1ff, 1.2));
      stripe.position.y = 2.62;
      const dot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.16), G(0xff8a3c, 1.4));
      dot.position.set(-1.2, 2.4, 0.02);
      g.add(panel, stripe, dot);
      for (const px of [-1.4, 1.4]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), M(0x3a3a4a));
        p.position.set(px, 1.2, 0);
        g.add(p);
      }
      break;
    }
    // ---- 廃坑: 坑木 (レーンをまたぐ支柱フレーム) ----
    // 軽量化: PointLightの代わりに発光スプライトで床の光だまりを表現
    // (ポイントライトは全マテリアルのフラグメントコストを押し上げるため廃坑では特に重い)
    case 'pitprop': {
      const woodM = M(0x6a4a2e, { roughness: 0.9 });
      const spanW = 4.8;
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 3.4, 6), woodM);
        post.position.set(side * spanW / 2, 1.7, 0);
        post.castShadow = gfx !== 'low';
        g.add(post);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(spanW + 0.6, 0.3, 0.34), woodM);
      lintel.position.y = 3.45;
      lintel.castShadow = gfx !== 'low';
      const brace = new THREE.Mesh(new THREE.BoxGeometry(spanW + 0.6, 0.18, 0.26), woodM);
      brace.position.y = 2.45;
      g.add(lintel, brace);
      // フレームの提灯 (発光メッシュ)
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), G(0xffb35c, 2.0));
      lamp.position.y = 3.08;
      g.add(lamp);
      // 床の光だまり (加算合成の擬似ライト — ライト数を増やさず見た目は同等)
      const glow = makeGlowSprite(0xffb35c, 0.09, 4.4);
      glow.position.y = 0.06;
      glow.updateMatrix();
      g.add(glow);
      w.animated.push((t) => {
        const k = 3.9 + Math.sin(t * 3.3 + d.z) * 1.3;
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.055 + k * 0.009;
        (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + k * 0.1;
      });
      break;
    }
    // ---- 廃坑: 脱線したトロッコ (小物) ----
    case 'cart': {
      const bodyM = M(0x5c4026, { roughness: 0.85 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.1), bodyM);
      body.position.y = 0.5;
      body.castShadow = gfx !== 'low';
      const ore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), G(0xffb347, 1.1));
      ore.position.y = 1.0;
      ore.scale.y = 0.7;
      g.add(body, ore);
      const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8);
      wheelGeo.rotateZ(Math.PI / 2); // 車軸をX方向へ
      for (const [wx, wz] of [[-0.6, 0.4], [0.6, 0.4], [-0.6, -0.4], [0.6, -0.4]]) {
        const wheel = new THREE.Mesh(wheelGeo, M(0x2a2a30));
        wheel.position.set(wx, 0.2, wz);
        g.add(wheel);
      }
      w.animated.push((t) => {
        ore.rotation.y = t * 0.4;
      });
      break;
    }
    // ---- 廃坑: 露出した銀鉱脈 ----
    case 'orevein': {
      const m = G(0xffc95c, 1.6);
      for (let i = 0; i < 4; i++) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 + (i % 3) * 0.08), m);
        c.position.set(Math.sin(i * 2.2) * 0.4, 0.14 + (i % 2) * 0.1, Math.cos(i * 2.2) * 0.4);
        g.add(c);
        w.animated.push((t) => {
          m.emissiveIntensity = 1.3 + Math.sin(t * 2.6 + i) * 0.5;
        });
      }
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.18, 8), M(0x3a3342, { roughness: 0.95 }));
      base.position.y = 0.09;
      g.add(base);
      break;
    }
  }
  w.group.add(g);
}

// ------------------------------------------------------------
// 草むら (ブロスタ風連結草むら・軽量&草っぽい見た目)
// ※ 以前の「木みたいな背の高い円錐」をやめ、幅広の低い草の塊に。
//   影オフ & メッシュ数削減で大幅軽量化。
// ------------------------------------------------------------

function buildBush(def: MapDef, b: { x: number; z: number; rx: number; rz: number }, gfx: GraphicsTier): THREE.Group {
  const g = new THREE.Group();
  g.position.set(b.x, 0, b.z);
  const mat = new THREE.MeshStandardMaterial({
    color: def.id === 'battlefield' ? 0x3a7a46 : def.id === 'station' ? 0x2f6a50 : def.id === 'mine' ? 0x2f7a5a : 0x3cae5c,
    roughness: 0.95,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: def.id === 'battlefield' ? 0x2f5e38 : def.id === 'station' ? 0x274e3c : def.id === 'mine' ? 0x245842 : 0x2f8a4a,
    roughness: 0.97,
  });
  // 地面の下草ディスク (連結感を出す土台)
  const under = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(b.rx, b.rz) * 1.02, gfx === 'ultimate' ? 24 : 14),
    darkMat,
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = 0.05;
  under.receiveShadow = true;
  g.add(under);
  // 草の塊: 幅広・低い「たけなわの草」(傾けた扁平円錐 + 潰した球のミックス)
  const density = gfx === 'ultimate' ? 1.35 : gfx === 'ultra' ? 1.15 : 1;
  const count = Math.max(3, Math.min(9, Math.floor((b.rx * b.rz) / 5 * density)));
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random());
    const px = Math.cos(a) * rr * b.rx * 0.92;
    const pz = Math.sin(a) * rr * b.rz * 0.92;
    if (Math.random() < 0.55) {
      // 草束: 幅広の低い円錐を外側に傾ける (木には見えない)
      const rad = 0.55 + Math.random() * 0.4;
      const h = 0.42 + Math.random() * 0.3;
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 5), mat);
      tuft.position.set(px, h * 0.32, pz);
      tuft.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
      tuft.userData.sway = true;
      g.add(tuft);
    } else {
      // 草の塊 (モウンド): 潰した球
      const r = 0.42 + Math.random() * 0.3;
      const mound = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), Math.random() < 0.4 ? darkMat : mat);
      mound.position.set(px, r * 0.42, pz);
      mound.scale.set(1.25, 0.5, 1.25);
      mound.rotation.y = Math.random() * Math.PI;
      mound.userData.sway = Math.random() < 0.4;
      g.add(mound);
    }
  }
  return g;
}

// ------------------------------------------------------------
// 廃坑マップ: 奈落 + 木の橋 + 円形の岩棚
// ------------------------------------------------------------

/** 擬似ライト用の放射グラデーションテクスチャ (色ごとにキャッシュ) */
const _glowTexCache = new Map<number, THREE.Texture>();
function glowTexture(color: number): THREE.Texture {
  let tex = _glowTexCache.get(color);
  if (tex) return tex;
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const ctx = cv.getContext('2d')!;
  const c = new THREE.Color(color);
  const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.95)`);
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.4)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  tex = new THREE.CanvasTexture(cv);
  _glowTexCache.set(color, tex);
  return tex;
}
const _glowPlaneGeo = (() => {
  let geo: THREE.PlaneGeometry | null = null;
  return () => {
    if (!geo) {
      geo = new THREE.PlaneGeometry(2, 2);
      geo.rotateX(-Math.PI / 2);
    }
    return geo;
  };
})();
export function makeGlowSprite(color: number, opacity: number, scale: number): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: glowTexture(color), color: 0xffffff, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(_glowPlaneGeo(), mat);
  mesh.scale.setScalar(scale);
  mesh.renderOrder = 2;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

/** 木の橋の板テクスチャ (横継ぎ目 + 木目) */
function plankTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#7c5f3a';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(40,26,14,0.9)';
  for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 2);
  for (let i = 0; i < 90; i++) {
    const v = 50 + Math.random() * 40;
    ctx.fillStyle = `rgba(${v},${v * 0.72},${v * 0.4},0.22)`;
    ctx.fillRect(Math.random() * 64, Math.random() * 64, 6 + Math.random() * 22, 1.5);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildMineTerrain(
  def: MapDef, group: THREE.Group, animated: ((t: number, dt: number) => void)[], gfx: GraphicsTier,
) {
  // ---- 奈落の底 (とても深い闇) ----
  const abyss = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshStandardMaterial({ color: 0x0b0812, roughness: 1, metalness: 0 }),
  );
  abyss.rotation.x = -Math.PI / 2;
  abyss.position.y = -17;
  abyss.matrixAutoUpdate = false;
  abyss.updateMatrix();
  group.add(abyss);

  // ---- 木の橋 (3レーン) + 桟道 + 岩棚 ----
  // 軽量化: 静的ジオメトリをマテリアル別にバッチ統合 (数百メッシュ→8メッシュ)
  const planks = plankTexture();
  planks.repeat.set(1, 26);
  const deckMat = new THREE.MeshStandardMaterial({ map: planks, roughness: 0.88, color: 0xcfa876 });
  const railMat = M(0x4e3820, { roughness: 0.92 });
  const deckBatch = new GeoBatch();    // 橋/桟道の甲板 (影を受ける)
  const railBatch = new GeoBatch();    // 手すり縁 (影を落とす)
  const postBatch = new GeoBatch();    // 手すり柱 (影なし)
  for (const lane of ['top', 'mid', 'bot'] as const) {
    const samples = LANE_SAMPLES[lane];
    deckBatch.add(ribbonGeometry(samples, 3.3, 0.02));
    // 桟道の縁 (落ちる直前のライン) + 手すり
    for (const side of [-1, 1]) {
      railBatch.add(ribbonGeometry(samples, 0.1, 0.62, side * 3.34));
    }
    // 手すり柱 (間引き配置)
    const postN = gfx === 'low' ? 8 : 14;
    const postGeo = new THREE.BoxGeometry(0.16, 0.72, 0.16);
    for (let i = 1; i < postN; i++) {
      const p = samples[Math.floor((i / postN) * (samples.length - 1))];
      for (const side of [-1, 1]) {
        batchAdd(postBatch, postGeo, p.x + side * 3.34, 0.34, p.z);
      }
    }
    postGeo.dispose();
  }

  // ---- トロッコ用レール (ミッド) ----
  const railMetal = new THREE.MeshStandardMaterial({ color: 0x5a5a68, metalness: 0.7, roughness: 0.35, emissive: 0x2a2a38, emissiveIntensity: 0.4 });
  const metalBatch = new GeoBatch();
  for (const side of [-1, 1]) {
    metalBatch.add(ribbonGeometry(LANE_SAMPLES.mid, 0.07, 0.1, side * 0.85));
  }

  // ---- 桟道 (walkways) ----
  if (def.walkways) {
    for (const wk of def.walkways) {
      const a = { x: wk.x1, z: wk.z1 };
      const b = { x: wk.x2, z: wk.z2 };
      deckBatch.add(ribbonGeometry([a, b], wk.w / 2, 0.02));
      // 桟道の手すり (両側)
      const dx = wk.x2 - wk.x1, dz = wk.z2 - wk.z1;
      const l = Math.hypot(dx, dz) || 1;
      const nx = (dz / l) * (wk.w / 2 + 0.06);
      const nz = (-dx / l) * (wk.w / 2 + 0.06);
      for (const side of [-1, 1]) {
        railBatch.add(ribbonGeometry([
          { x: wk.x1 + nx * side, z: wk.z1 + nz * side },
          { x: wk.x2 + nx * side, z: wk.z2 + nz * side },
        ], 0.08, 0.58));
      }
    }
  }

  // ---- 円形の岩棚 (足場) ----
  const shelfTop = M(0x352c40, { roughness: 0.96 });
  const shelfSide = M(0x241e30, { roughness: 0.98 });
  const shelfBatch = new GeoBatch();   // 棚本体 (影を落とす+受ける)
  const topBatch = new GeoBatch();     // 棚の上面 (影を受ける)
  const pillarBatch = new GeoBatch();  // 奈落へ伸びる岩柱 (影なし)
  const seg = gfx === 'low' ? 10 : 18;
  for (const p of def.platforms ?? []) {
    const shelfGeo = new THREE.CylinderGeometry(p.r * 0.99, p.r * 1.05, 1.5, seg);
    shelfGeo.translate(0, -0.72, 0);
    shelfBatch.add(shelfGeo);
    const topGeo = new THREE.CircleGeometry(p.r * 0.99, seg);
    topGeo.rotateX(-Math.PI / 2);
    topGeo.translate(0, 0.035, 0);
    topBatch.add(topGeo);
    const pillarGeo = new THREE.CylinderGeometry(p.r * 0.42, p.r * 0.58, 14, seg - 4);
    pillarGeo.translate(0, -8.4, 0);
    pillarBatch.add(pillarGeo);
  }

  // ---- バッチを統合メッシュとして追加 (見た目は従来と同一) ----
  const railCast = gfx !== 'low';
  const deck = deckBatch.build(deckMat, false, true);
  if (deck) group.add(deck);
  const rail = railBatch.build(railMat, railCast, false);
  if (rail) group.add(rail);
  const posts = postBatch.build(railMat, false, false);
  if (posts) group.add(posts);
  const metal = metalBatch.build(railMetal, false, false);
  if (metal) group.add(metal);
  const shelf = shelfBatch.build(shelfSide, railCast, true);
  if (shelf) group.add(shelf);
  const tops = topBatch.build(shelfTop, false, true);
  if (tops) group.add(tops);
  const pillars = pillarBatch.build(shelfSide, false, false);
  if (pillars) group.add(pillars);

  // ---- 橋の下に浮かぶエーテル結晶 (奈落の深度感) ----
  const n = gfx === 'low' ? 5 : 9;
  const cryMat = G(0x8a6cff, 1.6);
  cryMat.transparent = true;
  cryMat.opacity = 0.85;
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + Math.random() * 0.7), cryMat);
    const lane = LANE_SAMPLES[['top', 'mid', 'bot'][i % 3]];
    const s = lane[Math.floor(Math.random() * lane.length)];
    const baseY = -4 - Math.random() * 9;
    c.position.set(s.x + (Math.random() - 0.5) * 8, baseY, s.z + (Math.random() - 0.5) * 8);
    group.add(c);
    animated.push((t) => {
      c.rotation.y = t * 0.5 + i;
      c.rotation.x = Math.sin(t * 0.7 + i) * 0.3;
      c.position.y = baseY + Math.sin(t * 0.9 + i * 2.3) * 0.35;
    });
  }
}

// ------------------------------------------------------------
// タワー / ネクサス
// ------------------------------------------------------------

export function buildTowerMesh(team: Team): THREE.Group {
  const g = new THREE.Group();
  const mainC = team === 'blue' ? 0x3a6aff : 0xff4a5c;
  const stone = M(0x6a6478, { roughness: 0.8, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.5, 6.4, 10), stone);
  body.position.y = 3.2;
  body.castShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.15, 0.8, 10), M(0x827c94));
  cap.position.y = 6.7;
  const gemMat = G(mainC, 2.4);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.62), gemMat);
  gem.position.y = 7.9;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 8, 24), G(mainC, 1.6));
  ring.position.y = 5.2;
  ring.rotation.x = Math.PI / 2;
  g.add(body, cap, gem, ring);
  return g;
}

export function buildNexusMesh(team: Team): THREE.Group {
  const g = new THREE.Group();
  const mainC = team === 'blue' ? 0x3a6aff : 0xff4a5c;
  const stone = M(0x726c84, { roughness: 0.75, metalness: 0.25 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.4, 1.4, 12), stone);
  base.position.y = 0.7;
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.0, 2.6, 12), stone);
  mid.position.y = 2.6;
  mid.castShadow = true;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.4, 10), M(0x8a849e, { metalness: 0.4 }));
  spire.position.y = 5.5;
  const coreMat = G(mainC, 2.8);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.15), coreMat);
  core.position.y = 8.3;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.1, 8, 32), G(mainC, 2.0));
  halo.position.y = 8.3;
  halo.rotation.x = Math.PI / 2.3;
  g.add(base, mid, spire, core, halo);
  return g;
}

// ------------------------------------------------------------
// ワールド全体
// ------------------------------------------------------------

export function buildWorld(def: MapDef, gfx: GraphicsTier, lightMode?: boolean): WorldRefs {
  const group = new THREE.Group();
  const animated: ((t: number, dt: number) => void)[] = [];

  // ---- 廃坑マップ: 地形の代わりに奈落 + 橋を建設 ----
  if (def.platforms) {
    buildMineTerrain(def, group, animated, gfx);
  } else {
  // ---- 地形 (レーン/川付近は平坦化 + 頂点色で変化) ----
  const groundSeg = gfx === 'low' ? 24 : 72;
  const groundGeo = new THREE.PlaneGeometry(176, 176, groundSeg, groundSeg);
  const pos = groundGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cBase = new THREE.Color(def.groundColor);
  const cAcc = new THREE.Color(def.groundAccent);
  const cWet = new THREE.Color(def.id === 'battlefield' ? 0x554d38 : def.id === 'station' ? 0x45424e : 0x9a8252); // 川沿いの湿った土
  const cBed = new THREE.Color(def.id === 'battlefield' ? 0x37331f : def.id === 'station' ? 0x2e2c38 : 0x5f5330); // 水中の暗い泥底
  const tmpC = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i); // plane local: y = world z
    // 道路/川からの距離 → 平坦マスク
    let minD = 9999;
    for (let r = 0; r < ALL_ROAD_POINTS.length; r++) {
      const rp = ALL_ROAD_POINTS[r];
      const dx = x - rp.x;
      const dz = y - rp.z;
      const dd = dx * dx + dz * dz;
      if (dd < minD) minD = dd;
    }
    const d = Math.sqrt(minD);
    const flat = d < 5.5 ? 0.05 : d < 12 ? 0.05 + ((d - 5.5) / 6.5) * 0.95 : 1;
    const amp = gfx === 'low' ? 0.3 : 0.65;
    const h = (Math.sin(x * 0.11) * Math.cos(y * 0.13) + Math.sin(x * 0.043 + y * 0.061) * 0.6) * amp;
    const dist = Math.hypot(x, y);
    // ---- 物理リバーベッド: 水は低いところを流れる → 川筋だけ洼ませる ----
    let riverD = 9999;
    for (let r = 0; r < RIVER_SAMPLES.length; r++) {
      const rp = RIVER_SAMPLES[r];
      const dx = x - rp.x;
      const dz = y - rp.z;
      const dd = dx * dx + dz * dz;
      if (dd < riverD) riverD = dd;
    }
    riverD = Math.sqrt(riverD);
    const bedT = riverD < 4.6 ? 1 : riverD < 8.6 ? 1 - (riverD - 4.6) / 4 : 0;
    const bed = bedT * 0.62;
    pos.setZ(i, h * flat * (dist > 34 ? 1 : 0.45) - bed);
    // 頂点色: 2オクターブの擬似ノイズで地面の模様を描く
    const n1 = Math.sin(x * 0.33 + Math.sin(y * 0.27) * 1.4) * Math.cos(y * 0.29 + Math.sin(x * 0.19) * 1.2);
    const n2 = Math.sin(x * 0.09 + y * 0.07) * 0.5;
    const mixv = Math.max(0, Math.min(1, 0.5 + n1 * 0.3 + n2 * 0.25));
    tmpC.copy(cBase).lerp(cAcc, mixv);
    // 道路沿いは僅かに明るく(踏み固められた土)
    if (d < 7) tmpC.lerp(cAcc, 0.35 * (1 - d / 7));
    // 川沿いは湿った土色、水中は泥底色
    if (riverD < 9.5) tmpC.lerp(cWet, (1 - riverD / 9.5) * 0.55);
    if (bedT > 0) tmpC.lerp(cBed, bedT * 0.7);
    colors[i * 3] = tmpC.r;
    colors[i * 3 + 1] = tmpC.g;
    colors[i * 3 + 2] = tmpC.b;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, roughness: 0.93, metalness: 0.02,
  }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- 3レーン道路リボン ----
  const roadMat = M(def.laneColor, { roughness: 0.88 });
  const roadY = 0.07;
  for (const lane of ['top', 'mid', 'bot'] as const) {
    const road = new THREE.Mesh(ribbonGeometry(LANE_SAMPLES[lane], 3.3, roadY), roadMat);
    road.receiveShadow = true;
    group.add(road);
  }
  // 道路の縁取り (控えめな常時発光 - 点滅なし)
  for (const lane of ['top', 'mid', 'bot'] as const) {
    for (const side of [-1, 1]) {
      const lineMat = G(def.id === 'battlefield' ? 0xffc97a : def.id === 'station' ? 0xffd84d : 0x4fd8ff, 0.42);
      const line = new THREE.Mesh(ribbonGeometry(LANE_SAMPLES[lane], 0.12, roadY + 0.01, side * 3.3), lineMat);
      group.add(line);
    }
  }
  } // end: 通常地形 (廃坑以外)

  // ---- 川 (ミッド横断) - 物理準拠: 掘削済み河床 + 両岸 + 上流→下流の流れ ----
  if (def.river) {
    const waterY = -0.14; // 河床(-0.62)より上・岸(0)より下 → 水がチャネルに収まる
    // 本流の水面
    const riverMat = new THREE.MeshStandardMaterial({
      color: def.river.color, transparent: true, opacity: 0.8,
      roughness: 0.08, metalness: 0.55,
      emissive: def.river.color, emissiveIntensity: 0.3,
    });
    const river = new THREE.Mesh(ribbonGeometry(RIVER_SAMPLES, 4.9, waterY), riverMat);
    group.add(river);
    // 深部の水芯 (中心ほど深い色 = 水量の表現)
    const deepMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(def.river.color).multiplyScalar(0.5),
      transparent: true, opacity: 0.85, roughness: 0.05, metalness: 0.6,
    });
    group.add(new THREE.Mesh(ribbonGeometry(RIVER_SAMPLES, 2.7, waterY - 0.02), deepMat));
    // 両岸の濡れ縁 (水際)
    const shoreMat = M(def.id === 'battlefield' ? 0x5c5340 : def.id === 'station' ? 0x54505c : 0xb0945e, { roughness: 0.95 });
    for (const side of [-1, 1]) {
      const shore = new THREE.Mesh(ribbonGeometry(RIVER_SAMPLES, 1.0, 0.04, side * 5.4), shoreMat);
      shore.receiveShadow = true;
      group.add(shore);
    }
    if (gfx !== 'low') {
      // 流れの輝線 (西→東へ流れる Current)
      const flowN = 16;
      const flowGeo = new THREE.PlaneGeometry(0.34, 2.6);
      flowGeo.rotateX(-Math.PI / 2); // 長軸をZにして寝かせる
      const flowMat = new THREE.MeshBasicMaterial({
        color: 0xdcf8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const flowMeshes: THREE.Mesh[] = [];
      const flowT: number[] = [];
      const flowOff: number[] = [];
      const flowSpd: number[] = [];
      for (let i = 0; i < flowN; i++) {
        const fm = new THREE.Mesh(flowGeo, flowMat);
        group.add(fm);
        flowMeshes.push(fm);
        flowT.push(i / flowN);
        flowOff.push((Math.random() - 0.5) * 7);
        flowSpd.push(0.022 + (i % 4) * 0.007);
      }
      // 岸沿いのさざ波キラキラ
      const sparkleMat = G(0xd8f6ff, 0.9);
      sparkleMat.transparent = true;
      sparkleMat.opacity = 0.2;
      const sparkle = new THREE.Mesh(ribbonGeometry(RIVER_SAMPLES, 3.4, waterY + 0.05), sparkleMat);
      group.add(sparkle);
      animated.push((t, dt) => {
        riverMat.emissiveIntensity = 0.22 + Math.sin(t * 1.8) * 0.08;
        sparkleMat.opacity = 0.12 + Math.sin(t * 2.3 + 1) * 0.07;
        for (let i = 0; i < flowN; i++) {
          flowT[i] += dt * flowSpd[i];
          if (flowT[i] > 1) {
            flowT[i] -= 1;
            flowOff[i] = (Math.random() - 0.5) * 7;
          }
          const p = riverPoint(flowT[i]);
          const p2 = riverPoint(Math.min(1, flowT[i] + 0.012));
          const ang = Math.atan2(p2.x - p.x, p2.z - p.z);
          flowMeshes[i].position.set(p.x + Math.cos(ang) * flowOff[i], waterY + 0.1, p.z - Math.sin(ang) * flowOff[i]);
          flowMeshes[i].rotation.y = ang;
          flowMeshes[i].visible = flowT[i] > 0.02 && flowT[i] < 0.98;
        }
      });
    }
  }

  // ---- 中央広場 (発光リング) ----
  const plazaMat = G(def.id === 'battlefield' ? 0xffc97a : def.id === 'station' ? 0x8ad8ff : def.id === 'mine' ? 0xffb86a : 0x4fd8ff, 0.7);
  plazaMat.transparent = true;
  plazaMat.opacity = 0.75;
  const plaza = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.11, 8, 48), plazaMat);
  plaza.rotation.x = Math.PI / 2;
  plaza.position.y = 0.12;
  group.add(plaza);
  animated.push((t) => {
    plaza.rotation.z = t * 0.25;
    plazaMat.emissiveIntensity = 0.6 + Math.sin(t * 1.7) * 0.2;
  });

  // ---- 水 (リゾートの海) ----
  if (def.water) {
    const waterMat = new THREE.MeshStandardMaterial({
      color: def.water.color, transparent: true, opacity: 0.74,
      roughness: 0.12, metalness: 0.45,
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(def.water.size[0], def.water.size[1], 40, 40), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.35;
    group.add(water);
    const wpos = water.geometry.attributes.position as THREE.BufferAttribute;
    animated.push((t) => {
      for (let i = 0; i < wpos.count; i++) {
        const x = wpos.getX(i);
        const y = wpos.getY(i);
        wpos.setZ(i, Math.sin(x * 0.18 + t * 2) * 0.22 + Math.cos(y * 0.15 + t * 1.6) * 0.22);
      }
      wpos.needsUpdate = true;
    });
  }

  // ---- 草むら ----
  const bushMeshes = def.bushes.map((b) => {
    const bg = buildBush(def, b, lightMode ? 'medium' : gfx);
    group.add(bg);
    animated.push((t) => {
      // sway フラグ付きの草だけ軽く揺らす (負荷軽減)
      for (let i = 1; i < bg.children.length; i++) {
        const c = bg.children[i];
        if (c.userData.sway) c.rotation.z = Math.sin(t * 1.6 + i * 0.7) * 0.05;
      }
    });
    return bg;
  });

  // ---- 装飾 ----
  for (const d of def.decor) addDecor({ group, animated, bushMeshes, dispose: () => {} }, d, def, gfx);

  // ---- ステーション: 線路 (道床 + レール2本 + 枕木 + 警告ストライプ) ----
  if (def.id === 'station') {
    const rail = STATION_RAIL;
    const len = RAIL_LEN;
    const mx = (rail.x1 + rail.x2) / 2;
    const mz = (rail.z1 + rail.z2) / 2;
    const ang = -Math.atan2(rail.z2 - rail.z1, rail.x2 - rail.x1);
    // 道床 (バラスト)
    const ballast = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 4.2), M(0x4a4048, { roughness: 0.96 }));
    ballast.position.set(mx, 0.08, mz);
    ballast.rotation.y = ang;
    ballast.receiveShadow = true;
    group.add(ballast);
    // レール 2本 (夜でも見えるよう微発光)
    const railMat = new THREE.MeshStandardMaterial({ color: 0x9a9aa8, metalness: 0.8, roughness: 0.28, emissive: 0x5a6a8a, emissiveIntensity: 0.55 });
    for (const side of [-1, 1]) {
      const rx = mx - Math.sin(ang) * side * 0.72;
      const rz = mz + Math.cos(ang) * side * 0.72;
      const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.14), railMat);
      r.position.set(rx, 0.22, rz);
      r.rotation.y = ang;
      group.add(r);
    }
    // 枕木
    const tieMat = M(0x3a3028, { roughness: 0.95 });
    const tieN = Math.max(8, Math.floor(len / 2.6));
    for (let i = 0; i <= tieN; i++) {
      const t = i / tieN;
      const p = railPoint(t);
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 2.1), tieMat);
      tie.position.set(p.x, 0.13, p.z);
      tie.rotation.y = ang;
      group.add(tie);
    }
    // 警告ストライプ (踏みやすいように線路を明るくマーク)
    const stripeMat = G(0xffd84d, 0.7);
    for (const t of [0.2, 0.42, 0.58, 0.8]) {
      const p = railPoint(t);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 5.4), stripeMat);
      st.position.set(p.x, 0.19, p.z);
      st.rotation.y = ang;
      group.add(st);
    }
  }

  // ---- 壁 (ジャングルの遮蔽物) ----
  for (const w of def.walls ?? []) {
    const h = w.h ?? 2.5;
    const stone = def.id === 'battlefield' ? 0x454b60 : def.id === 'station' ? 0x5a5668 : def.id === 'mine' ? 0x6a4a2e : 0xc4a473;
    const stoneDark = def.id === 'battlefield' ? 0x31364a : def.id === 'station' ? 0x444050 : def.id === 'mine' ? 0x4a3320 : 0xa1834f;
    const trimC = def.id === 'battlefield' ? 0xffc97a : def.id === 'station' ? 0xffd84d : def.id === 'mine' ? 0xffb35c : 0x4fd8ff;
    const wg = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(w.w, h * 0.55, w.d), M(stoneDark, { roughness: 0.85 }));
    base.position.y = h * 0.275;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(w.w * 0.9, h * 0.5, w.d * 0.86), M(stone, { roughness: 0.78 }));
    upper.position.y = h * 0.55 + h * 0.25;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w.w * 0.98, 0.1, w.d * 0.94), G(trimC, 0.55));
    cap.position.y = h + 0.05;
    base.castShadow = true;
    upper.castShadow = true;
    base.receiveShadow = true;
    upper.receiveShadow = true;
    wg.add(base, upper, cap);
    wg.position.set(w.x, 0, w.z);
    group.add(wg);
  }

  // ---- 環境粒子 (朝の光の粒子) - 軽量モードでは省略 ----
  if (gfx !== 'low' && !lightMode && def.particle !== 'none') {
    const count = Math.floor(def.particleCount * (gfx === 'medium' ? 1 : gfx === 'high' ? 1.8 : gfx === 'ultimate' ? 3.6 : 3));
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 150;
      positions[i * 3 + 1] = Math.random() * 24;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 150;
      speeds[i] = 0.4 + Math.random() * 1.2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pmat = new THREE.PointsMaterial({
      color: def.particleColor,
      size: def.particle === 'ember' ? 0.28 : 0.22,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, pmat);
    group.add(points);
    animated.push((_t, dt) => {
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        let y = p.getY(i) + speeds[i] * dt * (def.particle === 'ember' ? 1.6 : def.particle === 'petal' ? -0.5 : 0.35);
        if (def.particle === 'ember') {
          if (y > 26) y = 0;
        } else if (def.particle === 'petal') {
          if (y < 0) y = 26;
        } else {
          if (y > 24) y = 0;
          if (y < 0) y = 24;
        }
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(_t * speeds[i] + i) * dt * (def.particle === 'spark' ? 0.8 : 0.5));
        p.setZ(i, p.getZ(i) + Math.cos(_t * speeds[i] * 0.8 + i) * dt * (def.particle === 'spark' ? 0.8 : 0.4));
      }
      p.needsUpdate = true;
    });
  }

  return {
    group,
    animated,
    bushMeshes,
    dispose: () => {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
    },
  };
}

export { buildSky };
