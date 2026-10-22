// ============================================================
// AETHER LEAGUE - VFX (発光弾・パーティクル・リング)
// ============================================================

import * as THREE from 'three';
import type { ProjShape, GlowType } from '../types';

/** 弾メッシュ生成 - 様々な形状 + 白発光/黒発光 */
export function makeProjectileMesh(shape: ProjShape, color: string, glow: GlowType, scale = 1): THREE.Group {
  const g = new THREE.Group();
  // ステラの飛ぶ大剣 (くるくる回転する剣・専用メッシュ)
  if (shape === 'sword') {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.95, 0.035),
      new THREE.MeshStandardMaterial({ color: '#f4f0ff', emissive: color, emissiveIntensity: 1.6, metalness: 0.85, roughness: 0.2 })
    );
    blade.position.y = 0.36;
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.95, 0.04),
      new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 3.4, roughness: 0.2 })
    );
    edge.position.set(0.06, 0.36, 0);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 4), blade.material as THREE.Material);
    tip.position.y = 0.92;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.09),
      new THREE.MeshStandardMaterial({ color: '#c8a84d', emissive: color, emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.3 }));
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.075),
      new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 3.0, roughness: 0.2 }));
    gem.position.set(0, -0.22, 0);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 6),
      new THREE.MeshStandardMaterial({ color: '#7a5c14', roughness: 0.6 }));
    grip.position.y = -0.36;
    const sparkleCount = 5;
    const sGeo = new THREE.BufferGeometry();
    const sPos = new Float32Array(sparkleCount * 3);
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    const sparkle = new THREE.Points(sGeo, new THREE.PointsMaterial({
      color: '#ffffff', size: 0.16, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    g.add(blade, edge, tip, guard, gem, grip, sparkle);
    g.scale.setScalar(scale);
    (g as unknown as { _sparkle: THREE.Points; _sparkGeo: THREE.BufferGeometry; _spin: number })._sparkle = sparkle;
    (g as unknown as { _sparkGeo: THREE.BufferGeometry })._sparkGeo = sGeo;
    (g as unknown as { _spin: number })._spin = Math.random() * 10;
    return g;
  }
  let geo: THREE.BufferGeometry;
  switch (shape) {
    case 'box': geo = new THREE.BoxGeometry(0.42, 0.42, 0.42); break;
    case 'octa': geo = new THREE.OctahedronGeometry(0.34); break;
    case 'tetra': geo = new THREE.TetrahedronGeometry(0.4); break;
    case 'torus': geo = new THREE.TorusGeometry(0.3, 0.11, 8, 18); break;
    case 'cone': geo = new THREE.ConeGeometry(0.3, 0.62, 7); break;
    case 'icosa': geo = new THREE.IcosahedronGeometry(0.32); break;
    case 'capsule': geo = new THREE.CapsuleGeometry(0.18, 0.4, 4, 10); break;
    case 'star': geo = new THREE.OctahedronGeometry(0.36, 0); break;
    case 'diamond': geo = new THREE.OctahedronGeometry(0.36); break;
    case 'crystal': {
      geo = new THREE.ConeGeometry(0.22, 0.72, 5);
      break;
    }
    case 'ring': geo = new THREE.TorusGeometry(0.34, 0.07, 8, 20); break;
    case 'shuriken': {
      const disc = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 4);
      geo = disc;
      break;
    }
    case 'arrow': geo = new THREE.ConeGeometry(0.09, 0.72, 5); break;
    default: geo = new THREE.SphereGeometry(0.3, 14, 12);
  }

  let mat: THREE.MeshStandardMaterial;
  if (glow === 'white') {
    // 白発光: 白コア+色エミス
    mat = new THREE.MeshStandardMaterial({
      color: '#ffffff', emissive: color, emissiveIntensity: 3.2,
      roughness: 0.15, metalness: 0.1,
    });
  } else {
    // 黒発光: 漆黒コア+反色リムエミス (ダークグロー)
    mat = new THREE.MeshStandardMaterial({
      color: '#05030c', emissive: color, emissiveIntensity: 2.4,
      roughness: 0.4, metalness: 0.3,
    });
  }
  const mesh = new THREE.Mesh(geo, mat);
  g.add(mesh);

  // 白発光は白コアを追加してキラキラ感
  if (glow === 'white') {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#ffffff' })
    );
    g.add(core);
  } else {
    // 黒発光は紫暈の外殻
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 10),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
      })
    );
    g.add(shell);
  }

  // キラキラ光粒
  const sparkleCount = 6;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(sparkleCount * 3);
  for (let i = 0; i < sparkleCount; i++) sPos[i * 3 + 1] = 0;
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sparkle = new THREE.Points(sGeo, new THREE.PointsMaterial({
    color: glow === 'white' ? '#ffffff' : color,
    size: 0.16, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  g.add(sparkle);

  g.scale.setScalar(scale);
  (g as unknown as { _sparkle: THREE.Points; _sparkGeo: THREE.BufferGeometry; _spin: number })._sparkle = sparkle;
  (g as unknown as { _sparkGeo: THREE.BufferGeometry })._sparkGeo = sGeo;
  (g as unknown as { _spin: number })._spin = Math.random() * 10;
  return g;
}

/** パーティクルバースト管理 */
export class ParticleSystem {
  points: THREE.Points;
  private cap: number;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private cursor = 0;
  private c = new THREE.Color();

  constructor(cap = 2200) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.maxLife = new Float32Array(cap);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.34, vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    for (let i = 0; i < cap; i++) this.pos[i * 3 + 1] = -999;
  }

  burst(x: number, y: number, z: number, color: string, count = 16, speed = 6, life = 0.6, up = 0.6) {
    this.c.set(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.cap;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * speed;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.cos(a) * r;
      this.vel[i * 3 + 1] = (Math.random() * 0.8 + 0.2) * speed * up;
      this.vel[i * 3 + 2] = Math.sin(a) * r;
      this.life[i] = life * (0.6 + Math.random() * 0.6);
      this.maxLife[i] = this.life[i];
      const k = 0.55 + Math.random() * 0.45;
      this.col[i * 3] = this.c.r * k; this.col[i * 3 + 1] = this.c.g * k; this.col[i * 3 + 2] = this.c.b * k;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      this.vel[i * 3 + 1] -= 9.8 * dt * 0.5;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.col[i * 3] *= 0.995; this.col[i * 3 + 1] *= 0.995; this.col[i * 3 + 2] *= 0.995;
      if (k < 0.5) {
        this.col[i * 3] *= 0.94; this.col[i * 3 + 1] *= 0.94; this.col[i * 3 + 2] *= 0.94;
      }
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.PointsMaterial).dispose();
  }
}

/** 拡大リングVFX */
export class RingFxPool {
  private pool: { mesh: THREE.Mesh; t: number; dur: number; active: boolean }[] = [];
  constructor(scene: THREE.Scene, count = 14) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#ffffff', transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 32), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, t: 0, dur: 1, active: false });
    }
  }
  spawn(x: number, z: number, color: string, maxR = 4, dur = 0.7, y = 0.35) {
    const p = this.pool.find((q) => !q.active) ?? this.pool[0];
    p.active = true;
    p.t = 0;
    p.dur = dur;
    p.mesh.visible = true;
    p.mesh.position.set(x, y, z);
    (p.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    p.mesh.userData.maxR = maxR;
    p.mesh.scale.setScalar(0.2);
  }
  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.t += dt;
      const k = p.t / p.dur;
      if (k >= 1) { p.active = false; p.mesh.visible = false; continue; }
      const maxR = (p.mesh.userData.maxR as number) ?? 4;
      p.mesh.scale.setScalar(0.2 + k * maxR);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.85;
    }
  }
}

/** タワー攻撃ビーム */
export class BeamPool {
  private pool: { mesh: THREE.Mesh; t: number; dur: number; active: boolean }[] = [];
  constructor(scene: THREE.Scene, count = 6) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#ff5c7a', transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 6, 1, true), mat);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, t: 0, dur: 0.18, active: false });
    }
  }
  spawn(from: THREE.Vector3, to: THREE.Vector3, color: string, dur = 0.16, radius = 0.09) {
    const p = this.pool.find((q) => !q.active) ?? this.pool[0];
    p.active = true;
    p.t = 0;
    p.dur = dur;
    p.mesh.visible = true;
    const mid = from.clone().add(to).multiplyScalar(0.5);
    p.mesh.position.copy(mid);
    const d = to.clone().sub(from);
    p.mesh.scale.set(radius / 0.09, d.length(), radius / 0.09);
    p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    (p.mesh.material as THREE.MeshBasicMaterial).color.set(color);
  }
  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.t += dt;
      if (p.t >= p.dur) { p.active = false; p.mesh.visible = false; continue; }
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - p.t / p.dur);
    }
  }
}
