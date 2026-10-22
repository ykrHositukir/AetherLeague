'use client';

// ============================================================
// AETHER LEAGUE - タイトル画面3D背景 (キャラ展示+ブルーム)
// ============================================================

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildCharacter, animateRig, type CharacterRig } from '@/game/engine/models';
import { CHARACTERS } from '@/game/characters';

export function TitleBg({ charIds }: { charIds?: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 2.1, 8.5);
    camera.lookAt(0, 1.35, 0);

    scene.add(new THREE.AmbientLight(0x405090, 1.1));
    const key = new THREE.DirectionalLight(0xbfd8ff, 2.4);
    key.position.set(4, 8, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7c5cff, 1.6);
    rim.position.set(-6, 4, -4);
    scene.add(rim);
    const warm = new THREE.PointLight(0xff9a4d, 10, 24);
    warm.position.set(-3, 2, 3);
    scene.add(warm);

    // キャラ展示
    const rigs: { rig: CharacterRig; x: number; phase: number }[] = [];
    const ids = charIds?.length ? charIds : ['blaze', 'frost', 'shadow', 'lumina'];
    const spread = ids.length > 3 ? 2.5 : 1.9;
    ids.forEach((id, i) => {
      const char = CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
      const rig = buildCharacter(char);
      const x = (i - (ids.length - 1) / 2) * spread;
      rig.root.position.set(x, 0, i % 2 === 0 ? 0.4 : -0.3);
      rig.root.scale.setScalar(1.05);
      scene.add(rig.root);
      rigs.push({ rig, x, phase: i * 1.7 });
    });

    // 床
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48),
      new THREE.MeshStandardMaterial({ color: 0x0a1024, roughness: 0.25, metalness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.4, 0.05, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x4fd1ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending })
    );
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.02;
    scene.add(glowRing);

    // 光粒子
    const pCount = 260;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 22;
      pPos[i * 3 + 1] = Math.random() * 8;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: 0x8fd8ff, size: 0.08, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(pts);

    // ブルーム
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.6, 0.55));
    composer.addPass(new OutputPass());

    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      composer.setSize(w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    const clock = new THREE.Clock();
    let alive = true;
    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      for (const r of rigs) {
        r.rig.anim = 'idle';
        animateRig(r.rig, dt, 0);
        r.rig.root.rotation.y = Math.sin(t * 0.4 + r.phase) * 0.45;
        r.rig.root.position.y = Math.sin(t * 1.4 + r.phase) * 0.05;
      }
      glowRing.rotation.z = t * 0.4;
      (glowRing.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t * 2) * 0.2;
      const pp = pGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pCount; i++) {
        let y = pp.getY(i) + dt * (0.3 + (i % 5) * 0.12);
        if (y > 8) y = 0;
        pp.setY(i, y);
      }
      pp.needsUpdate = true;
      camera.position.x = Math.sin(t * 0.16) * 1.1;
      camera.lookAt(0, 1.35, 0);
      composer.render();
    };
    loop();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
      renderer.dispose();
    };
  }, [charIds]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

/** キャラ選択用の1体プレビュー */
export function CharPreview({ charId, skin }: { charId: string; skin?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const char = CHARACTERS.find((c) => c.id === charId) ?? CHARACTERS[0];
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 1.7, 5.4);
    camera.lookAt(0, 1.15, 0);

    scene.add(new THREE.AmbientLight(0x405090, 1.2));
    const key = new THREE.DirectionalLight(0xd8e8ff, 2.6);
    key.position.set(3, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7c5cff, 1.8);
    rim.position.set(-4, 3, -4);
    scene.add(rim);

    const rig = buildCharacter(char, skin);
    scene.add(rig.root);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.6, 0.18, 32),
      new THREE.MeshStandardMaterial({ color: 0x141c38, roughness: 0.3, metalness: 0.6, emissive: char.colors.aura, emissiveIntensity: 0.12 })
    );
    disc.position.y = -0.09;
    scene.add(disc);

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    const clock = new THREE.Clock();
    let alive = true;
    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      rig.anim = Math.sin(clock.elapsedTime * 0.5) > 0.72 ? 'attack' : 'idle';
      animateRig(rig, dt, 0);
      rig.root.rotation.y += dt * 0.7;
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
      renderer.dispose();
    };
  }, [charId, skin]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
