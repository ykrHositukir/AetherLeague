// ============================================================
// AETHER LEAGUE - キャラクター3Dモデル生成
// プリミティブ組み合わせのスタイライズド3Dモデル
// ============================================================

import * as THREE from 'three';
import type { CharColors, CharacterDef, Team, WeaponType } from '../types';

export type AnimState = 'idle' | 'run' | 'attack' | 'cast' | 'guard' | 'dead' | 'victory';

export interface CharacterRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  weapon: THREE.Group;
  cape?: THREE.Mesh;
  shieldMesh: THREE.Mesh;
  auraRing: THREE.Group;
  ringB?: THREE.Mesh;
  glowMats: THREE.MeshStandardMaterial[];
  /** フリル専用: スカートの素材 (怒りMAXで少し脈動させる用) */
  frillSkirt?: THREE.MeshStandardMaterial;
  baseY: number;
  anim: AnimState;
  animT: number;   // アニメーション内経過時間
  clock: number;   // 常時進行クロック
  deadT: number;
}

const M = (c: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.15, ...opts });

function glowMat(c: string, intensity = 1.6): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: c, emissive: c, emissiveIntensity: intensity,
    roughness: 0.3, metalness: 0.1,
  });
}

// ------------------------------------------------------------
// 武器
// ------------------------------------------------------------

function buildWeapon(type: WeaponType, c: CharColors): THREE.Group {
  const g = new THREE.Group();
  const dark = M(c.secondary, { metalness: 0.5, roughness: 0.4 });
  const glow = glowMat(c.accent, 2.2);

  switch (type) {
    case 'sword': {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.045), M('#d8e0f0', { metalness: 0.85, roughness: 0.2 }));
      blade.position.y = 0.95;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.5, 0.05), glow);
      edge.position.set(0.055, 0.95, 0);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.12), dark);
      guard.position.y = 0.18;
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 8), M(c.primary));
      grip.position.y = 0;
      const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), glow);
      pommel.position.y = -0.2;
      g.add(blade, edge, guard, grip, pommel);
      break;
    }
    case 'staff': {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.9, 8), dark);
      rod.position.y = 0.6;
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.19), glowMat(c.aura, 2.6));
      orb.position.y = 1.65;
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.028, 8, 24), glow);
      halo.position.y = 1.65;
      halo.rotation.x = Math.PI / 2.4;
      g.add(rod, orb, halo);
      break;
    }
    case 'daggers': {
      for (const side of [-1, 1]) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.62, 4), M('#e8ecff', { metalness: 0.8, roughness: 0.25 }));
        blade.rotation.x = Math.PI;
        blade.position.set(side * 0.09, 0.32, 0);
        const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), glow);
        spark.position.set(side * 0.09, 0.05, 0);
        g.add(blade, spark);
      }
      break;
    }
    case 'hammer': {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8), dark);
      rod.position.y = 0.5;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.42), M(c.primary, { metalness: 0.4, roughness: 0.5 }));
      head.position.y = 1.28;
      const rune = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 18), glow);
      rune.position.y = 1.28;
      g.add(rod, head, rune);
      break;
    }
    case 'wand': {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.15, 8), M('#f0e8d0'));
      rod.position.y = 0.42;
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), glowMat(c.accent, 2.8));
      star.position.y = 1.06;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 20), glow);
      ring.position.y = 1.06;
      g.add(rod, star, ring);
      break;
    }
    case 'plush': {
      // フリルのうさぎのぬいぐるみ杖
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.05, 8), M('#f8f0f8', { roughness: 0.6 }));
      rod.position.y = 0.38;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), M('#fff0f6', { roughness: 0.8 }));
      head.position.y = 1.05;
      const earGeo = new THREE.CapsuleGeometry(0.045, 0.3, 4, 8);
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(earGeo, M('#fff0f6', { roughness: 0.8 }));
        ear.position.set(side * 0.09, 1.36, -0.02);
        ear.rotation.z = side * 0.22;
        const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.2, 4, 8), M(c.primary, { roughness: 0.8 }));
        inner.position.set(side * 0.09, 1.36, 0.02);
        inner.rotation.z = side * 0.22;
        g.add(ear, inner);
      }
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), M('#3a2a3a'));
        eye.position.set(side * 0.075, 1.09, 0.18);
        g.add(eye);
      }
      const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 6, 12), glowMat(c.accent, 1.6));
      ribbon.position.y = 0.88;
      ribbon.rotation.x = Math.PI / 2;
      g.add(rod, head, ribbon);
      break;
    }
    case 'shuriken': {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 4), M('#1a1430', { metalness: 0.7, roughness: 0.3 }));
      disc.rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 4), glowMat(c.accent, 1.8));
        spike.position.set(Math.cos((i * Math.PI) / 2) * 0.38, Math.sin((i * Math.PI) / 2) * 0.38, 0);
        spike.rotation.z = -((i * Math.PI) / 2) + Math.PI / 2;
        g.add(spike);
      }
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), glow);
      g.add(disc, core);
      break;
    }
    case 'trident': {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 8), M('#2a7a9a', { metalness: 0.6, roughness: 0.35 }));
      rod.position.y = 0.55;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), glowMat(c.aura, 2));
      head.position.y = 1.6;
      for (const side of [-1, 1]) {
        const prong = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 6), M(c.primary, { metalness: 0.5 }));
        prong.position.set(side * 0.16, 1.48, 0);
        g.add(prong);
      }
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), glowMat('#a8f0e0', 2.4));
      pearl.position.y = 0.95;
      g.add(rod, head, pearl);
      break;
    }
    case 'bow': {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 8, 24, Math.PI * 1.35), M(c.primary, { metalness: 0.4 }));
      arc.rotation.z = Math.PI * 0.82;
      const stringMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 1.02, 4),
        M('#f0fff8', { emissive: '#9cf0c8', emissiveIntensity: 0.8 })
      );
      stringMesh.rotation.z = Math.PI * 0.325;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), glowMat(c.accent, 2.2));
      gem.position.set(0.28, 0, 0);
      g.add(arc, stringMesh, gem);
      break;
    }
    case 'greatsword': {
      // ステラの星剣 (大きくて豪華な両手剣 + 星のジェム)
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.72, 0.055), M('#f4f0ff', { metalness: 0.82, roughness: 0.18 }));
      blade.position.y = 1.06;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.72, 0.06), glow);
      edge.position.set(0.08, 1.06, 0);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 4), M('#f4f0ff', { metalness: 0.82, roughness: 0.18 }));
      tip.position.y = 2.05;
      tip.rotation.y = Math.PI / 4;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.14), M('#c8a84d', { metalness: 0.7, roughness: 0.3 }));
      guard.position.y = 0.16;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), glowMat(c.accent, 2.6));
      gem.position.y = 0.16;
      gem.position.z = 0.1;
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.42, 8), M(c.secondary));
      grip.position.y = -0.08;
      const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), glow);
      pommel.position.y = -0.34;
      g.add(blade, edge, tip, guard, gem, grip, pommel);
      break;
    }
  }
  return g;
}

// ------------------------------------------------------------
// 髪・帽子
// ------------------------------------------------------------

function buildHat(type: CharacterDef['hat'], c: CharColors): THREE.Group {
  const g = new THREE.Group();
  const hairM = M(c.hair, { roughness: 0.7 });
  const glowM = glowMat(c.accent, 1.2);

  switch (type) {
    case 'spiky': {
      for (let i = 0; i < 7; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 5), hairM);
        const a = (i / 7) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.24, 0.52, Math.sin(a) * 0.24 - 0.05);
        spike.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        g.add(spike);
      }
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.62, 5), hairM);
      top.position.y = 0.6;
      g.add(top);
      break;
    }
    case 'witch': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.05, 20), M(c.secondary));
      brim.position.y = 0.5;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.85, 14), M(c.secondary));
      cone.position.y = 0.92;
      cone.rotation.z = 0.14;
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 18), glowM);
      band.position.y = 0.56;
      band.rotation.x = Math.PI / 2;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), glowM);
      tip.position.set(-0.12, 1.34, 0);
      g.add(brim, cone, band, tip);
      break;
    }
    case 'helm': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.56, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), M(c.primary, { metalness: 0.55, roughness: 0.35 }));
      dome.position.y = 0.1;
      const horn1 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 6), M('#e8d8a8'));
      horn1.position.set(0.34, 0.5, 0);
      horn1.rotation.z = -0.7;
      const horn2 = horn1.clone();
      horn2.position.x = -0.34;
      horn2.rotation.z = 0.7;
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.5), glowM);
      crest.position.y = 0.55;
      g.add(dome, horn1, horn2, crest);
      break;
    }
    case 'crown': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 20), glowMat('#ffd86a', 1.8));
      ring.position.y = 0.44;
      ring.rotation.x = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), glowMat(c.accent, 2.4));
        gem.position.set(Math.cos(a) * 0.42, 0.54, Math.sin(a) * 0.42);
        g.add(gem);
      }
      // 長い髪
      const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), hairM);
      hairBack.position.set(0, 0.05, -0.16);
      hairBack.scale.set(1, 1.25, 1);
      g.add(ring, hairBack);
      break;
    }
    case 'ninja': {
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.34, 0.5), M(c.secondary));
      mask.position.set(0, -0.12, 0.06);
      const headband = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.05, 6, 18), M(c.primary));
      headband.position.y = 0.22;
      headband.rotation.x = Math.PI / 2.15;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.03), glowM);
      tail.position.set(0.3, 0.14, -0.28);
      tail.rotation.z = -0.5;
      g.add(mask, headband, tail);
      break;
    }
    case 'twin': {
      for (const side of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.75, 7), hairM);
        tail.position.set(side * 0.5, 0.28, -0.1);
        tail.rotation.z = side * -0.85;
        const tie = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), glowM);
        tie.position.set(side * 0.36, 0.5, -0.08);
        g.add(tail, tie);
      }
      const bangs = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.4), hairM);
      bangs.position.y = 0.16;
      g.add(bangs);
      break;
    }
    case 'ponytail': {
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.95, 7), hairM);
      tail.position.set(0, 0.18, -0.55);
      tail.rotation.x = -1.1;
      g.add(tail);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.53, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hairM);
      top.position.y = 0.14;
      g.add(top);
      break;
    }
    case 'hood': {
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), M(c.primary, { roughness: 0.8 }));
      hood.position.y = 0.12;
      const point = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 8), M(c.primary, { roughness: 0.8 }));
      point.position.set(0, 0.58, -0.18);
      point.rotation.x = -0.4;
      g.add(hood, point);
      break;
    }
    case 'band': {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 18), glowM);
      band.position.y = 0.3;
      band.rotation.x = Math.PI / 2;
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 5), M(c.accent));
      feather.position.set(0.3, 0.5, -0.14);
      feather.rotation.z = -0.6;
      g.add(band, feather);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hairM);
      top.position.y = 0.15;
      g.add(top);
      break;
    }
    case 'wings': {
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.85, 5), glowMat(c.accent, 1.4));
        wing.position.set(side * 0.3, 0.42, -0.3);
        wing.rotation.set(0.3, 0, side * 1.5);
        g.add(wing);
      }
      break;
    }
    case 'fin': {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 5), glowMat(c.aura, 1.3));
      fin.position.set(0, 0.55, -0.05);
      fin.rotation.x = -0.3;
      const side1 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 4), glowMat(c.accent, 1.1));
      side1.position.set(0.42, 0.14, 0);
      side1.rotation.z = -1.3;
      const side2 = side1.clone();
      side2.position.x = -0.42;
      side2.rotation.z = 1.3;
      g.add(fin, side1, side2);
      break;
    }
    case 'frill': {
      // フリル魔女見習い: 大きなリボン + 縦ロール巻き髪 + フリルカチューシャ
      const bangs = new THREE.Mesh(new THREE.SphereGeometry(0.53, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.44), hairM);
      bangs.position.y = 0.14;
      bangs.scale.set(1.04, 1.06, 1.06);
      g.add(bangs);
      for (const side of [-1, 1]) {
        // 縦ロール (ドリル巻き)
        const drill = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.85, 8), hairM);
        drill.position.set(side * 0.52, 0.02, -0.12);
        drill.rotation.z = side * 0.5;
        drill.scale.set(1, 1, 1);
        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 6, 12), hairM);
        ring1.position.set(side * 0.42, 0.28, -0.1);
        ring1.rotation.y = Math.PI / 2;
        const tie = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), glowM);
        tie.position.set(side * 0.42, 0.44, -0.1);
        g.add(drill, ring1, tie);
      }
      // 頭のてっぺんの大きなリボン
      const ribbonM = M(c.primary, { roughness: 0.55 });
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), ribbonM);
        wing.position.set(side * 0.22, 0.52, -0.06);
        wing.scale.set(1.25, 0.7, 0.55);
        g.add(wing);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), glowM);
      knot.position.set(0, 0.52, -0.06);
      g.add(knot);
      // フリルカチューシャ (白レース)
      const lace = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 6, 20), M('#fff4fa', { roughness: 0.6 }));
      lace.position.y = 0.26;
      lace.rotation.x = Math.PI / 2.1;
      g.add(lace);
      break;
    }
    case 'halo': {
      // ステラ: 天使の輪 + 黄色いロングヘア (サイドの長い髪 + 後ろ髪)
      const bangs = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.38), hairM);
      bangs.position.y = 0.2;
      bangs.scale.set(1.04, 1.04, 1.06);
      g.add(bangs);
      for (const side of [-1, 1]) {
        // 肩まで届く長いサイドヘア
        const sideHair = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.62, 4, 8), hairM);
        sideHair.position.set(side * 0.46, -0.18, -0.08);
        sideHair.rotation.z = side * 0.1;
        g.add(sideHair);
      }
      // 後ろのなびくロングヘア
      const backHair = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.98, 8), hairM);
      backHair.position.set(0, -0.26, -0.3);
      backHair.rotation.x = -0.24;
      g.add(backHair);
      // 前髪の星のヘアピン (アクセント)
      const pin = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), glowMat(c.accent, 2.2));
      pin.position.set(0.2, 0.3, 0.42);
      g.add(pin);
      // 天使の輪 (頭上に浮く金のリング・発光)
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.032, 8, 28), glowMat('#ffe66a', 2.4));
      halo.position.y = 0.78;
      halo.rotation.x = Math.PI / 2.2;
      g.add(halo);
      break;
    }
    default: break;
  }
  return g;
}

// ------------------------------------------------------------
// キャラモデル構築
// ------------------------------------------------------------

export function buildCharacter(char: CharacterDef, skinTint?: string): CharacterRig {
  const c = char.colors;
  const primary = skinTint ?? c.primary;
  const tintAura = skinTint ? skinTint : c.aura;
  let frillSkirtMat: THREE.MeshStandardMaterial | undefined;

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.02;
  root.add(body);

  const glowMats: THREE.MeshStandardMaterial[] = [];
  const heavy = char.bodyType === 'heavy';
  const slim = char.bodyType === 'slim';

  // 胴体
  const torsoH = heavy ? 0.95 : slim ? 0.72 : 0.82;
  const torsoW = heavy ? 0.62 : slim ? 0.42 : 0.52;
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(torsoW, torsoH * 0.62, 4, 12),
    M(primary, { roughness: 0.6 })
  );
  torso.position.y = torsoH * 0.62;
  body.add(torso);

  // 胸当て (armor plate)
  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(torsoW * 1.45, torsoH * 0.42, torsoW * 0.55),
    M(c.secondary, { metalness: 0.45, roughness: 0.4 })
  );
  chest.position.set(0, torsoH * 0.78, torsoW * 0.42);
  body.add(chest);
  const chestTrim = new THREE.Mesh(
    new THREE.BoxGeometry(torsoW * 1.5, torsoH * 0.07, torsoW * 0.6),
    glowMat(c.accent, 1.3)
  );
  chestTrim.position.set(0, torsoH * 0.94, torsoW * 0.4);
  body.add(chestTrim);
  glowMats.push(chestTrim.material as THREE.MeshStandardMaterial);

  // 胸元コア(発光)
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), glowMat(tintAura, 2.4));
  core.position.set(0, torsoH * 0.72, torsoW * 0.74);
  body.add(core);
  glowMats.push(core.material as THREE.MeshStandardMaterial);

  // 斜めストラップ
  if (!heavy) {
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(torsoW * 2.05, torsoH * 0.12, torsoW * 1.5),
      M(c.secondary, { roughness: 0.7 })
    );
    strap.position.set(0, torsoH * 0.72, torsoW * 0.12);
    strap.rotation.z = 0.7;
    strap.rotation.y = 0.3;
    body.add(strap);
  }

  // ベルト + バックル
  const belt = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.92, 0.05, 6, 18), M(c.secondary, { roughness: 0.6 }));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = torsoH * 0.42;
  body.add(belt);
  const buckle = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), glowMat(c.accent, 1.8));
  buckle.position.set(0, torsoH * 0.42, torsoW * 0.92);
  body.add(buckle);
  glowMats.push(buckle.material as THREE.MeshStandardMaterial);

  // 肩鎧 (2層 + 発光トリム)
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(
      new THREE.SphereGeometry(heavy ? 0.24 : 0.19, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
      M(c.secondary, { metalness: 0.5 })
    );
    pauldron.position.set(side * (torsoW + 0.06), torsoH * 0.98, 0);
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(heavy ? 0.24 : 0.19, 0.022, 6, 14),
      glowMat(c.accent, 1.4)
    );
    trim.position.copy(pauldron.position);
    trim.rotation.x = Math.PI / 2.6;
    trim.rotation.y = side * 0.35;
    body.add(pauldron, trim);
    glowMats.push(trim.material as THREE.MeshStandardMaterial);
  }

  // 頭
  const head = new THREE.Group();
  head.position.y = torsoH * 1.28;
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.47, 16, 14), M(c.skin, { roughness: 0.75 }));
  headM.scale.set(1, 0.96, 0.98);
  head.add(headM);

  // 基本髪 (帽子の下に常に存在)
  const hairBase = new THREE.Mesh(
    new THREE.SphereGeometry(0.49, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    M(c.hair, { roughness: 0.72 })
  );
  hairBase.position.set(0, 0.03, -0.03);
  hairBase.scale.set(1.02, 1.05, 1.06);
  head.add(hairBase);
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M(c.hair, { roughness: 0.72 }));
  hairBack.position.set(0, -0.08, -0.34);
  hairBack.scale.set(1.3, 1.1, 0.7);
  head.add(hairBack);

  // 目(発光) + ハイライト + 眉
  const eyeM = glowMat(c.eye, 2.2);
  const specM = M('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1.2, roughness: 0.2 });
  const browM = M(c.hair, { roughness: 0.8 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.066, 8, 8), eyeM);
    eye.position.set(side * 0.16, 0.03, 0.4);
    eye.scale.set(1, 1.3, 0.6);
    head.add(eye);
    const spec = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), specM);
    spec.position.set(side * 0.16 - 0.02, 0.07, 0.45);
    head.add(spec);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.028, 0.03), browM);
    brow.position.set(side * 0.16, 0.16, 0.42);
    brow.rotation.z = side * -0.14;
    head.add(brow);
  }
  glowMats.push(eyeM);

  head.add(buildHat(char.hat, c));
  body.add(head);

  // 腕
  const armLen = heavy ? 0.62 : 0.56;
  const mkArm = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * (torsoW + 0.14), torsoH * 0.96, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, armLen, 4, 8), M(primary));
    arm.position.y = -armLen * 0.52;
    g.add(arm);
    // 腕バンド
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.09, 8), M(c.secondary, { metalness: 0.4 }));
    band.position.y = -armLen * 0.3;
    g.add(band);
    // ガントレット (手甲)
    const gauntlet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.105, 0.16, 8),
      M(c.secondary, { metalness: 0.5, roughness: 0.42 })
    );
    gauntlet.position.y = -armLen * 0.84;
    g.add(gauntlet);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), M(c.skin));
    hand.position.y = -armLen * 1.02;
    g.add(hand);
    return g;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  body.add(armL, armR);

  // 武器(右手)
  const weapon = buildWeapon(char.weapon, c);
  weapon.position.set(0, -armLen * 0.95, 0.04);
  weapon.rotation.x = -0.25;
  armR.add(weapon);
  if (char.weapon === 'daggers') {
    const w2 = buildWeapon('daggers', c);
    w2.position.set(0, -armLen * 0.95, 0.04);
    armL.add(w2);
  }

  // 脚
  const mkLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * torsoW * 0.5, torsoH * 0.42, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, torsoH * 0.42, 4, 8), M(c.secondary));
    leg.position.y = -torsoH * 0.24;
    g.add(leg);
    // 太ももバンド
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 8), M(c.accent, { metalness: 0.3, roughness: 0.5 }));
    thigh.position.y = -torsoH * 0.08;
    g.add(thigh);
    // 膝アーマー
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), M(c.secondary, { metalness: 0.45 }));
    knee.position.set(0, -torsoH * 0.38, 0.06);
    g.add(knee);
    // ブーツ
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.135, 0.2, 8), M(c.secondary, { roughness: 0.55 }));
    boot.position.y = -torsoH * 0.46;
    g.add(boot);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.12, 0.34), M(c.accent, { roughness: 0.4 }));
    foot.position.set(0, -torsoH * 0.5, 0.07);
    g.add(foot);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.1), glowMat(c.accent, 1.1));
    toe.position.set(0, -torsoH * 0.49, 0.24);
    g.add(toe);
    return g;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);
  body.add(legL, legR);

  // フリル (フリルキャラ専用): ふわふわフリルドレス + 白エプロン + 膝ソックス
  if (char.hat === 'frill') {
    // 2段フレアのスカート (メインの衣装)
    const skirtMat = M(c.primary, { roughness: 0.6 });
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 1.5, torsoH * 0.78, 12, 1, true), skirtMat);
    skirt.position.y = torsoH * 0.02;
    skirt.material.side = THREE.DoubleSide;
    body.add(skirt);
    // スカートの裾フリル (白レース 2段)
    for (const [ty, tr] of [[-torsoH * 0.32, torsoW * 1.32], [-torsoH * 0.16, torsoW * 1.18]] as const) {
      const frill = new THREE.Mesh(
        new THREE.TorusGeometry(tr, 0.06, 6, 18),
        M('#fff4fa', { roughness: 0.62 })
      );
      frill.rotation.x = Math.PI / 2;
      frill.position.y = ty;
      body.add(frill);
    }
    // 腰のリボンベルト
    const belt = new THREE.Mesh(
      new THREE.TorusGeometry(torsoW * 0.92, 0.05, 6, 18),
      M(c.secondary, { roughness: 0.5 })
    );
    belt.rotation.x = Math.PI / 2;
    belt.position.y = torsoH * 0.42;
    body.add(belt);
    // 胸元のおリボン
    const bowM = M('#ff9ec4', { roughness: 0.5 });
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bowM);
      wing.position.set(side * 0.11, torsoH * 0.62, torsoW * 0.52);
      wing.scale.set(1.3, 0.75, 0.5);
      body.add(wing);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), glowMat('#ffd0e8', 1.2));
    knot.position.set(0, torsoH * 0.62, torsoW * 0.55);
    body.add(knot);
    // 膝までの白ソックス
    for (const side of [-1, 1]) {
      const sock = new THREE.Mesh(
        new THREE.CylinderGeometry(0.105, 0.12, torsoH * 0.34, 8),
        M('#fff4fa', { roughness: 0.65 })
      );
      sock.position.set(side * torsoW * 0.5, torsoH * 0.14, 0);
      body.add(sock);
    }
    frillSkirtMat = skirtMat;
  }

  // ルーミー: ふわふわピンクの2段フレアワンピース + 白ソックス
  // (普通のかわいい健全衣装。胸元のおリボンはそのままチャームポイント)
  if (char.id === 'roomy') {
    // 2段フレアのピンクスカート (ワンピースの裾)
    const skirtMat = M(c.primary, { roughness: 0.6 });
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 1.5, torsoH * 0.8, 12, 1, true), skirtMat);
    skirt.position.y = torsoH * 0.02;
    skirt.material.side = THREE.DoubleSide;
    body.add(skirt);
    // スカートの裾フリル (白レース 2段)
    for (const [ty, tr] of [[-torsoH * 0.33, torsoW * 1.34], [-torsoH * 0.16, torsoW * 1.2]] as const) {
      const frill = new THREE.Mesh(
        new THREE.TorusGeometry(tr, 0.06, 6, 18),
        M('#fff4fa', { roughness: 0.62 })
      );
      frill.rotation.x = Math.PI / 2;
      frill.position.y = ty;
      body.add(frill);
    }
    // 腰の白いリボンベルト
    const waist = new THREE.Mesh(
      new THREE.TorusGeometry(torsoW * 0.98, 0.045, 6, 18),
      M('#fff4fa', { roughness: 0.55 })
    );
    waist.rotation.x = Math.PI / 2;
    waist.position.y = torsoH * 0.42;
    body.add(waist);
    // 胸元のおリボン (チャームポイント)
    const bowM = M('#ff9ec4', { roughness: 0.5 });
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bowM);
      wing.position.set(side * 0.1, torsoH * 0.62, torsoW * 0.52);
      wing.scale.set(1.3, 0.75, 0.5);
      body.add(wing);
    }
    const chestKnot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), glowMat('#ffd0e8', 1.2));
    chestKnot.position.set(0, torsoH * 0.62, torsoW * 0.55);
    body.add(chestKnot);
    // 膝までの白ソックス
    for (const side of [-1, 1]) {
      const sock = new THREE.Mesh(
        new THREE.CylinderGeometry(0.105, 0.12, torsoH * 0.34, 8),
        M('#fff4fa', { roughness: 0.65 })
      );
      sock.position.set(side * torsoW * 0.5, torsoH * 0.14, 0);
      body.add(sock);
    }
    frillSkirtMat = skirtMat;
  }

  // ステラ: 天使の白い翼 (背中) + 白と金のフレアスカート
  if (char.hat === 'halo') {
    // 背中の天使の翼 (白発光の3枚羽根 × 2)
    for (const side of [-1, 1]) {
      for (let f = 0; f < 3; f++) {
        const wing = new THREE.Mesh(
          new THREE.ConeGeometry(0.13 - f * 0.025, 0.72 - f * 0.14, 5),
          glowMat('#fff8e8', 1.15)
        );
        wing.position.set(side * (0.2 + f * 0.05), torsoH * 1.02, -torsoW * 0.62 - f * 0.06);
        wing.rotation.set(0.45, side * -0.4, side * (1.9 + f * 0.14));
        body.add(wing);
      }
    }
    // 白×金のフレアスカート (天使の衣装)
    const skirtMat = M('#fff8e8', { roughness: 0.58 });
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 1.42, torsoH * 0.72, 12, 1, true), skirtMat);
    skirt.position.y = torsoH * 0.04;
    skirt.material.side = THREE.DoubleSide;
    body.add(skirt);
    const hem = new THREE.Mesh(
      new THREE.TorusGeometry(torsoW * 1.26, 0.055, 6, 18),
      glowMat(c.primary, 1.25)
    );
    hem.rotation.x = Math.PI / 2;
    hem.position.y = -torsoH * 0.28;
    body.add(hem);
    frillSkirtMat = skirtMat;
  }

  // マント
  let cape: THREE.Mesh | undefined;
  if (char.cape) {
    cape = new THREE.Mesh(new THREE.PlaneGeometry(torsoW * 2.1, torsoH * 1.35, 4, 6), M(c.secondary, { side: THREE.DoubleSide, roughness: 0.75, transparent: true, opacity: 0.96 }));
    cape.position.set(0, torsoH * 0.6, -torsoW * 0.75);
    cape.rotation.x = 0.12;
    body.add(cape);
  }

  // 背中エンブレム (発光)
  const emblem = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 16), glowMat(tintAura, 1.6));
  emblem.position.set(0, torsoH * 0.8, -torsoW * 0.68);
  body.add(emblem);
  glowMats.push(emblem.material as THREE.MeshStandardMaterial);

  // ガードシールド(通常は非表示)
  const shieldMat = glowMat(tintAura, 1.2);
  shieldMat.transparent = true;
  shieldMat.opacity = 0.4;
  const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.55, 18, 14), shieldMat);
  shieldMesh.position.y = 1.0;
  shieldMesh.visible = false;
  root.add(shieldMesh);

  // オーラ (メインリング + 逆回転リング + 接地グロー)
  const auraGroup = new THREE.Group();
  const auraMat = glowMat(tintAura, 1.5);
  auraMat.transparent = true;
  auraMat.opacity = 0.55;
  const auraRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.045, 8, 32), auraMat);
  auraRing.rotation.x = Math.PI / 2;
  auraRing.position.y = 0.08;
  auraGroup.add(auraRing);
  glowMats.push(auraMat);

  const ringBMat = glowMat(c.accent, 1.1);
  ringBMat.transparent = true;
  ringBMat.opacity = 0.4;
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 6, 24), ringBMat);
  ringB.rotation.x = Math.PI / 2.6;
  ringB.position.y = 0.3;
  auraGroup.add(ringB);
  glowMats.push(ringBMat);

  const discMat = new THREE.MeshBasicMaterial({
    color: tintAura, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.03;
  auraGroup.add(disc);
  root.add(auraGroup);

  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o !== disc) o.castShadow = true;
  });

  return {
    root, body, head, armL, armR, legL, legR, weapon, cape, shieldMesh,
    auraRing: auraGroup, ringB,
    glowMats, frillSkirt: frillSkirtMat, baseY: 0, anim: 'idle', animT: 0, clock: Math.random() * 10, deadT: 0,
  };
}

// ------------------------------------------------------------
// フリルのお昼寝ベッド (あったかい子供用ベッド)
// ------------------------------------------------------------

export function buildBed(): THREE.Group {
  const g = new THREE.Group();
  const W = 1.9;   // 横幅
  const L = 3.3;   // 縦長 (頭側 +Z)
  const wood = (c: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.05, ...extra });

  // 脚4本
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), wood('#a9744f'));
      leg.position.set(sx * (W / 2 - 0.14), 0.25, sz * (L / 2 - 0.16));
      g.add(leg);
    }
  }
  // 土台フレーム
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W, 0.22, L), wood('#c08a5d'));
  frame.position.y = 0.42;
  g.add(frame);
  // マットレス (白)
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(W - 0.16, 0.2, L - 0.14), wood('#fdf6ee', { roughness: 0.85 }));
  mattress.position.y = 0.6;
  g.add(mattress);
  // 枕
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(W - 0.7, 0.16, 0.62), wood('#ffffff', { roughness: 0.9 }));
  pillow.position.set(0, 0.76, L / 2 - 0.5);
  g.add(pillow);
  // 掛け布団 (フリルピンク)
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(W - 0.08, 0.12, L * 0.6), wood('#ffd0e8', { roughness: 0.8 }));
  blanket.position.set(0, 0.74, -L * 0.16);
  g.add(blanket);
  // ヘッドボード + フットボード
  const head = new THREE.Mesh(new THREE.BoxGeometry(W, 0.8, 0.12), wood('#c08a5d'));
  head.position.set(0, 0.72, L / 2);
  g.add(head);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, 0.12), wood('#c08a5d'));
  foot.position.set(0, 0.6, -L / 2);
  g.add(foot);
  // ハートの飾り (ヘッドボード上)
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), wood('#ff9ec4', { emissive: '#ff9ec4', emissiveIntensity: 0.5 }));
  heart.scale.set(1.1, 0.9, 0.55);
  heart.position.set(0, 1.2, L / 2);
  g.add(heart);

  g.traverse((o) => {
    if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return g;
}

// ------------------------------------------------------------
// パルの相棒: 猟犬シャドウ (体力600の召喚犬)
// ------------------------------------------------------------

export function buildDog(team: Team, aura: string): THREE.Group {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({
    color: team === 'blue' ? '#2a3a52' : '#522a34',
    roughness: 0.75, metalness: 0.05,
  });
  const furDark = new THREE.MeshStandardMaterial({
    color: team === 'blue' ? '#1a2638' : '#381a22',
    roughness: 0.8,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: aura, emissive: aura, emissiveIntensity: 1.8, roughness: 0.3,
  });
  const tooth = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });

  // 胴体 (前向き +Z)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.62, 6, 12), fur);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0.62, -0.05);
  // 胸当て (チーム発光)
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glow);
  chest.scale.set(1, 0.8, 0.6);
  chest.position.set(0, 0.66, 0.3);
  // 頭
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), fur);
  head.position.set(0, 0.94, 0.56);
  head.scale.set(1, 0.94, 1.05);
  // 鼻先
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.24), furDark);
  snout.position.set(0, 0.86, 0.8);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), furDark);
  nose.position.set(0, 0.92, 0.93);
  // 牙
  for (const sx of [-1, 1]) {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 5), tooth);
    fang.position.set(sx * 0.07, 0.78, 0.9);
    fang.rotation.x = Math.PI;
    g.add(fang);
  }
  // 耳 (ピンと立った狐耳)
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), furDark);
    ear.position.set(sx * 0.17, 1.22, 0.46);
    ear.rotation.z = sx * -0.24;
    g.add(ear);
  }
  // 目 (発光)
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glow);
    eye.position.set(sx * 0.12, 1.0, 0.76);
    g.add(eye);
  }
  // 脚4本
  const legGeo = new THREE.CylinderGeometry(0.075, 0.06, 0.5, 6);
  for (const sx of [-1, 1]) {
    for (const sz of [1, -1]) {
      const leg = new THREE.Mesh(legGeo, furDark);
      leg.position.set(sx * 0.2, 0.25, sz * 0.32);
      g.add(leg);
    }
  }
  // 尻尾 (上がった巻き尾)
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.36, 4, 8), fur);
  tail.position.set(0, 0.92, -0.5);
  tail.rotation.x = -0.9;
  // 首輪 + エーテルタグ
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 6, 16), glow);
  collar.rotation.x = Math.PI / 2 - 0.25;
  collar.position.set(0, 0.84, 0.4);
  g.add(body, chest, head, snout, nose, tail, collar);

  g.traverse((o) => {
    if (o instanceof THREE.Mesh) { o.castShadow = true; }
  });
  return g;
}

// ------------------------------------------------------------
// アニメーション更新
// ------------------------------------------------------------

export function animateRig(rig: CharacterRig, dt: number, speed01 = 0) {
  rig.animT += dt;
  rig.clock += dt;
  const t = rig.clock;
  const a = rig.anim;

  if (a === 'dead') {
    rig.deadT += dt;
    const k = Math.min(rig.deadT * 2.2, 1);
    rig.root.rotation.z = -k * (Math.PI / 2) * 0.94;
    rig.body.position.y = rig.baseY - k * 0.1;
    rig.auraRing.visible = false;
    return;
  }
  rig.auraRing.visible = true;
  rig.root.rotation.z = 0;

  switch (a) {
    case 'run': {
      const f = t * 11 * (0.6 + speed01 * 0.7);
      rig.legL.rotation.x = Math.sin(f) * 0.85;
      rig.legR.rotation.x = -Math.sin(f) * 0.85;
      rig.armL.rotation.x = -Math.sin(f) * 0.7;
      rig.armR.rotation.x = Math.sin(f) * 0.35 - 0.35;
      rig.body.position.y = Math.abs(Math.sin(f)) * 0.09;
      rig.body.rotation.x = 0.14;
      rig.body.rotation.z = Math.sin(f * 0.5) * 0.04;
      if (rig.cape) rig.cape.rotation.x = 0.28 + Math.sin(f * 0.9) * 0.1;
      break;
    }
    case 'attack': {
      const k = Math.min(rig.animT / 0.34, 1);
      const swing = k < 0.45 ? k / 0.45 : 1 - (k - 0.45) / 0.55;
      rig.armR.rotation.x = -2.4 * swing + 0.4;
      rig.armR.rotation.z = -0.4 * swing;
      rig.body.rotation.y = -0.45 * swing;
      rig.body.rotation.x = 0.1 * swing;
      rig.legL.rotation.x = 0.25 * swing;
      rig.legR.rotation.x = -0.2 * swing;
      rig.body.position.y = 0.04 * swing;
      if (rig.cape) rig.cape.rotation.x = 0.16 + swing * 0.14;
      break;
    }
    case 'cast': {
      const k = Math.min(rig.animT / 0.5, 1);
      const pulse = Math.sin(k * Math.PI);
      rig.armR.rotation.x = -2.6 * pulse;
      rig.armR.rotation.z = -0.15;
      rig.armL.rotation.x = -1.2 * pulse;
      rig.body.rotation.x = -0.12 * pulse;
      rig.body.position.y = 0.06 * pulse;
      rig.legL.rotation.x = 0;
      rig.legR.rotation.x = 0;
      rig.head.rotation.x = -0.15 * pulse;
      break;
    }
    case 'guard': {
      rig.legL.rotation.x = 0.4;
      rig.legR.rotation.x = -0.3;
      rig.body.rotation.x = 0.22;
      rig.body.position.y = -0.12;
      rig.armL.rotation.x = -1.5;
      rig.armL.rotation.z = 0.5;
      rig.armR.rotation.x = -1.2;
      rig.head.rotation.x = 0.15;
      break;
    }
    case 'victory': {
      const f = t * 4;
      rig.armL.rotation.x = -2.6;
      rig.armR.rotation.x = -2.6;
      rig.armL.rotation.z = 0.35 + Math.sin(f) * 0.15;
      rig.armR.rotation.z = -0.35 - Math.sin(f) * 0.15;
      rig.body.position.y = Math.abs(Math.sin(f * 0.7)) * 0.14;
      rig.legL.rotation.x = 0;
      rig.legR.rotation.x = 0;
      break;
    }
    default: { // idle
      const f = t * 2.2;
      rig.body.position.y = Math.sin(f) * 0.045;
      rig.body.rotation.x = 0.02 + Math.sin(f * 0.7) * 0.02;
      rig.body.rotation.z = Math.sin(f * 0.55) * 0.03;
      rig.armL.rotation.x = Math.sin(f * 0.9) * 0.09;
      rig.armR.rotation.x = -0.28 + Math.sin(f * 0.9 + 1) * 0.09;
      rig.armL.rotation.z = 0.08;
      rig.armR.rotation.z = -0.08;
      rig.legL.rotation.x = 0;
      rig.legR.rotation.x = 0;
      rig.head.rotation.x = Math.sin(f * 0.5) * 0.05;
      rig.head.rotation.y = Math.sin(f * 0.32) * 0.12;
      if (rig.cape) rig.cape.rotation.x = 0.1 + Math.sin(f * 0.8) * 0.05;
      break;
    }
  }

  // オーラ (浮遊 + パルス + 逆回転サブリング)
  rig.auraRing.position.y = Math.sin(t * 2) * 0.03;
  const mainRing = rig.auraRing.children[0] as THREE.Mesh;
  if (mainRing) mainRing.scale.setScalar(1 + Math.sin(t * 2.4) * 0.05);
  if (rig.ringB) {
    rig.ringB.rotation.z -= dt * 2.1;
    rig.ringB.rotation.x = Math.PI / 2.6 + Math.sin(t * 1.3) * 0.18;
  }
  // 武器ゆらぎ
  rig.weapon.rotation.z = Math.sin(t * 1.7) * 0.06;
}
