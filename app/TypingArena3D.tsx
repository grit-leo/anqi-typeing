"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type ArenaStatus = "ready" | "playing" | "complete";

type TypingArena3DProps = {
  word: string;
  typedLength: number;
  correctHits: number;
  mistakes: number;
  streak: number;
  score: number;
  timeLeft: number;
  wave: number;
  status: ArenaStatus;
  target: string;
  hint: string;
  onStart: () => void;
  onExit: () => void;
};

type LiveState = Omit<TypingArena3DProps, "onStart" | "onExit">;

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawWordTexture(canvas: HTMLCanvasElement, word: string, typedLength: number) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "rgba(24, 20, 72, 0.94)");
  gradient.addColorStop(1, "rgba(67, 50, 145, 0.94)");
  context.fillStyle = gradient;
  roundedRect(context, 16, 18, canvas.width - 32, canvas.height - 36, 38);
  context.fill();
  context.strokeStyle = "rgba(156, 241, 255, 0.7)";
  context.lineWidth = 5;
  context.stroke();

  const display = word.toUpperCase().replaceAll(" ", "·");
  context.font = "800 72px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textBaseline = "middle";
  const widths = [...display].map((character) => context.measureText(character).width);
  const totalWidth = widths.reduce((total, width) => total + width, 0);
  let cursor = (canvas.width - totalWidth) / 2;
  [...display].forEach((character, index) => {
    context.fillStyle = index < typedLength ? "#65f0bf" : index === typedLength ? "#ffd45d" : "#ffffff";
    context.shadowColor = index === typedLength ? "rgba(255, 211, 89, 0.9)" : "rgba(0, 0, 0, 0)";
    context.shadowBlur = index === typedLength ? 18 : 0;
    context.fillText(character, cursor, canvas.height / 2 + 3);
    cursor += widths[index];
  });
  context.shadowBlur = 0;
}

function makeSeededRandom(seedStart: number) {
  let seed = seedStart;
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export function TypingArena3D(props: TypingArena3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<LiveState>(props);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    liveRef.current = props;
  }, [props]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !window.WebGLRenderingContext) {
      window.requestAnimationFrame(() => setFallback(true));
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      window.requestAnimationFrame(() => setFallback(true));
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.className = "three-canvas-element";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080a28);
    scene.fog = new THREE.FogExp2(0x11113d, 0.036);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
    camera.position.set(0, 1.15, 8.2);

    scene.add(new THREE.HemisphereLight(0x9ccaff, 0x2b164d, 1.8));
    const keyLight = new THREE.DirectionalLight(0xffe1ad, 3.2);
    keyLight.position.set(4, 7, 6);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const cyanLight = new THREE.PointLight(0x55e8d1, 18, 12, 2);
    cyanLight.position.set(-3, 0.5, 3);
    scene.add(cyanLight);
    const dangerLight = new THREE.PointLight(0xff4c65, 0, 9, 2);
    dangerLight.position.set(0, 1, 3);
    scene.add(dangerLight);

    const random = makeSeededRandom(42);
    const starPositions = new Float32Array(520 * 3);
    const starColors = new Float32Array(520 * 3);
    for (let index = 0; index < 520; index += 1) {
      const radius = 12 + random() * 25;
      const angle = random() * Math.PI * 2;
      starPositions[index * 3] = Math.cos(angle) * radius;
      starPositions[index * 3 + 1] = (random() - 0.35) * 22;
      starPositions[index * 3 + 2] = Math.sin(angle) * radius - 8;
      const warmth = random();
      starColors[index * 3] = 0.68 + warmth * 0.32;
      starColors[index * 3 + 1] = 0.75 + warmth * 0.2;
      starColors[index * 3 + 2] = 1;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: 0.075, vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false }));
    scene.add(stars);

    const planetGroup = new THREE.Group();
    planetGroup.position.set(0, -4.75, -2.2);
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 52, 36),
      new THREE.MeshStandardMaterial({ color: 0x5d55db, roughness: 0.68, metalness: 0.06, emissive: 0x1d145f, emissiveIntensity: 0.45 }),
    );
    planet.receiveShadow = true;
    planetGroup.add(planet);
    const planetGlow = new THREE.Mesh(
      new THREE.SphereGeometry(3.76, 36, 24),
      new THREE.MeshBasicMaterial({ color: 0x6eead3, transparent: true, opacity: 0.08, side: THREE.BackSide, blending: THREE.AdditiveBlending }),
    );
    planetGroup.add(planetGlow);
    const planetRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.35, 0.09, 12, 120),
      new THREE.MeshBasicMaterial({ color: 0xffce58, transparent: true, opacity: 0.76 }),
    );
    planetRing.rotation.x = 1.18;
    planetRing.rotation.z = -0.18;
    planetGroup.add(planetRing);
    scene.add(planetGroup);

    const ship = new THREE.Group();
    ship.position.set(-3.1, -1.25, 2.1);
    ship.rotation.z = -0.12;
    const shipBody = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.35, 16), new THREE.MeshStandardMaterial({ color: 0xf1f2ff, roughness: 0.32, metalness: 0.24 }));
    shipBody.rotation.z = -Math.PI / 2;
    shipBody.castShadow = true;
    ship.add(shipBody);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 12), new THREE.MeshStandardMaterial({ color: 0x65e4d0, emissive: 0x2ca993, emissiveIntensity: 0.9, roughness: 0.18 }));
    cockpit.position.set(0.1, 0.18, 0);
    cockpit.scale.set(1.2, 0.7, 0.8);
    ship.add(cockpit);
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xff775f, roughness: 0.45 });
    [-1, 1].forEach((direction) => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.34), wingMaterial);
      wing.position.set(-0.22, direction * 0.34, 0);
      wing.rotation.z = direction * 0.35;
      ship.add(wing);
    });
    const engineGlow = new THREE.PointLight(0xff9355, 8, 3, 2);
    engineGlow.position.set(-0.75, 0, 0);
    ship.add(engineGlow);
    scene.add(ship);

    const meteor = new THREE.Group();
    meteor.position.set(0.6, 0.25, 0.8);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x7f62c6, roughness: 0.83, metalness: 0.03, emissive: 0x281c5d, emissiveIntensity: 0.25, flatShading: true });
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 1), rockMaterial);
    rock.castShadow = true;
    meteor.add(rock);
    const craterMaterial = new THREE.MeshStandardMaterial({ color: 0x4b367f, roughness: 1 });
    [[0.45, 0.26, 0.66], [-0.38, 0.34, 0.72], [0.14, -0.52, 0.68]].forEach(([x, y, z], index) => {
      const crater = new THREE.Mesh(new THREE.SphereGeometry(0.13 + index * 0.02, 10, 7), craterMaterial);
      crater.position.set(x, y, z);
      crater.scale.z = 0.32;
      meteor.add(crater);
    });
    const targetRing = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.025, 8, 72), new THREE.MeshBasicMaterial({ color: 0x71efda, transparent: true, opacity: 0.68 }));
    targetRing.rotation.x = Math.PI / 2;
    meteor.add(targetRing);
    const aura = new THREE.Mesh(new THREE.SphereGeometry(1.08, 24, 18), new THREE.MeshBasicMaterial({ color: 0x8b7cff, transparent: true, opacity: 0.08, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
    meteor.add(aura);

    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 640;
    labelCanvas.height = 192;
    drawWordTexture(labelCanvas, liveRef.current.word, liveRef.current.typedLength);
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    labelTexture.minFilter = THREE.LinearFilter;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false }));
    label.position.set(0, 1.48, 0);
    label.scale.set(4.7, 1.42, 1);
    label.renderOrder = 8;
    meteor.add(label);
    scene.add(meteor);

    const orbiters: THREE.Mesh[] = [];
    [[-3.7, 1.6, -2.5], [3.8, 1.9, -3.8], [2.9, -1.3, -2.6], [-2.4, 3.0, -5.4]].forEach(([x, y, z], index) => {
      const orbiter = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.22 + index * 0.06, 0),
        new THREE.MeshStandardMaterial({ color: index % 2 ? 0xffb650 : 0x6d62c9, roughness: 0.82, flatShading: true }),
      );
      orbiter.position.set(x, y, z);
      scene.add(orbiter);
      orbiters.push(orbiter);
    });

    const beamGeometry = new THREE.BufferGeometry();
    beamGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const beamMaterial = new THREE.LineBasicMaterial({ color: 0x67f4d1, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    const beam = new THREE.Line(beamGeometry, beamMaterial);
    scene.add(beam);

    const particleCount = 54;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleDirections = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const speed = 0.8 + random() * 1.8;
      particleDirections[index * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      particleDirections[index * 3 + 1] = Math.cos(phi) * speed;
      particleDirections[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: 0xffcf57, size: 0.12, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.visible = false;
    scene.add(particles);

    const pointerTarget = new THREE.Vector2(0, 0);
    const pointerCurrent = new THREE.Vector2(0, 0);
    const clock = new THREE.Clock();
    let frame = 0;
    let visible = true;
    let beamUntil = 0;
    let hitPulse = 0;
    let shake = 0;
    let explosionAge = 9;
    let lastWord = liveRef.current.word;
    let lastTyped = liveRef.current.typedLength;
    let lastCorrect = liveRef.current.correctHits;
    let lastMistakes = liveRef.current.mistakes;

    const triggerExplosion = () => {
      particles.position.copy(meteor.position);
      particlePositions.fill(0);
      particleGeometry.attributes.position.needsUpdate = true;
      particleMaterial.opacity = 1;
      particles.visible = true;
      explosionAge = 0;
      shake = reduceMotion ? 0 : 0.24;
    };

    const resize = () => {
      const width = Math.max(320, mount.clientWidth);
      const height = Math.max(300, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.05 });
    intersectionObserver.observe(mount);
    const onPointerMove = (event: PointerEvent) => {
      const bounds = mount.getBoundingClientRect();
      pointerTarget.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2);
    };
    const onPointerLeave = () => pointerTarget.set(0, 0);
    mount.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("pointerleave", onPointerLeave);

    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      if (!visible || document.hidden) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      const live = liveRef.current;

      if (live.word !== lastWord) {
        triggerExplosion();
        lastWord = live.word;
        lastTyped = live.typedLength;
        drawWordTexture(labelCanvas, live.word, live.typedLength);
        labelTexture.needsUpdate = true;
      } else if (live.typedLength !== lastTyped) {
        drawWordTexture(labelCanvas, live.word, live.typedLength);
        labelTexture.needsUpdate = true;
        lastTyped = live.typedLength;
      }
      if (live.correctHits > lastCorrect) {
        const positions = beamGeometry.attributes.position as THREE.BufferAttribute;
        const from = new THREE.Vector3();
        const to = new THREE.Vector3();
        ship.getWorldPosition(from);
        meteor.getWorldPosition(to);
        positions.setXYZ(0, from.x + 0.6, from.y, from.z);
        positions.setXYZ(1, to.x, to.y, to.z);
        positions.needsUpdate = true;
        beamMaterial.opacity = 1;
        beamUntil = time + 0.13;
        hitPulse = 1;
        lastCorrect = live.correctHits;
      }
      if (live.mistakes > lastMistakes) {
        shake = reduceMotion ? 0 : 0.16;
        dangerLight.intensity = 16;
        lastMistakes = live.mistakes;
      }

      const typedProgress = live.word.length ? live.typedLength / live.word.length : 0;
      const targetZ = 0.85 - typedProgress * 2.15;
      meteor.position.z = THREE.MathUtils.lerp(meteor.position.z, targetZ, 0.08);
      meteor.position.x = 0.55 + Math.sin(time * 0.9) * 0.22;
      meteor.position.y = 0.25 + Math.cos(time * 1.15) * 0.12;
      rock.rotation.x += delta * 0.34;
      rock.rotation.y += delta * 0.48;
      targetRing.rotation.z -= delta * 0.72;
      targetRing.scale.setScalar(1 + Math.sin(time * 2.7) * 0.045);
      hitPulse = Math.max(0, hitPulse - delta * 7);
      rock.scale.setScalar(1 + hitPulse * 0.14);
      rockMaterial.emissive.setHex(hitPulse > 0 ? 0x8c651e : 0x281c5d);
      beamMaterial.opacity = time < beamUntil ? Math.max(0, (beamUntil - time) * 7.7) : 0;
      dangerLight.intensity = THREE.MathUtils.lerp(dangerLight.intensity, 0, 0.12);

      if (explosionAge < 1.15) {
        explosionAge += delta;
        const attribute = particleGeometry.attributes.position as THREE.BufferAttribute;
        for (let index = 0; index < particleCount; index += 1) {
          const drag = explosionAge * (1 - explosionAge * 0.28);
          attribute.setXYZ(index, particleDirections[index * 3] * drag, particleDirections[index * 3 + 1] * drag, particleDirections[index * 3 + 2] * drag);
        }
        attribute.needsUpdate = true;
        particleMaterial.opacity = Math.max(0, 1 - explosionAge / 1.15);
      } else {
        particles.visible = false;
      }

      orbiters.forEach((orbiter, index) => {
        orbiter.rotation.x += delta * (0.25 + index * 0.06);
        orbiter.rotation.y += delta * (0.32 + index * 0.05);
        if (!reduceMotion) orbiter.position.y += Math.sin(time * 0.7 + index) * 0.0009;
      });
      planet.rotation.y += delta * 0.035;
      planetRing.rotation.z -= delta * 0.025;
      stars.rotation.y += delta * 0.006;
      if (!reduceMotion) ship.position.y = -1.25 + Math.sin(time * 2.1) * 0.07;

      pointerCurrent.lerp(pointerTarget, reduceMotion ? 0 : 0.045);
      const jitterX = shake > 0 ? (random() - 0.5) * shake : 0;
      const jitterY = shake > 0 ? (random() - 0.5) * shake : 0;
      shake = Math.max(0, shake - delta * 1.3);
      camera.position.x = pointerCurrent.x * 0.38 + jitterX;
      camera.position.y = 1.15 - pointerCurrent.y * 0.2 + jitterY;
      camera.lookAt(pointerCurrent.x * 0.14, -0.45 - pointerCurrent.y * 0.08, -1.15);
      renderer.render(scene, camera);
    };
    animate();

    const onContextLost = (event: Event) => {
      event.preventDefault();
      window.requestAnimationFrame(() => setFallback(true));
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      scene.traverse((object) => {
        const renderable = object as THREE.Mesh & { material?: THREE.Material | THREE.Material[]; geometry?: THREE.BufferGeometry };
        renderable.geometry?.dispose();
        const materials = Array.isArray(renderable.material) ? renderable.material : renderable.material ? [renderable.material] : [];
        materials.forEach((material) => {
          const withMap = material as THREE.Material & { map?: THREE.Texture };
          withMap.map?.dispose();
          material.dispose();
        });
      });
      labelTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [fallback]);

  const shield = Math.max(8, 100 - props.mistakes * 8);

  if (fallback) {
    return (
      <div className="three-arena three-fallback" aria-label="3D 星球守卫战兼容模式">
        <div className="fallback-planet">🪐</div>
        <strong>已切换到轻量守卫模式</strong>
        <p>当前设备未开启 3D 加速，打字和计分仍可正常进行。</p>
        <div className="three-dom-word">{props.word.split("").map((character, index) => <span className={index < props.typedLength ? "done" : index === props.typedLength ? "current" : ""} key={index}>{character === " " ? "·" : character}</span>)}</div>
        {props.status === "ready" ? <button className="arena-start" onClick={props.onStart}>开始守卫</button> : <button className="arena-exit" onClick={props.onExit}>退出本局</button>}
      </div>
    );
  }

  return (
    <div className="three-arena" aria-label="3D 星球守卫战游戏场景" tabIndex={0}>
      <div className="three-mount" ref={mountRef} />
      <div className="three-badge"><i /> WEBGL 3D</div>
      <div className="arena-hud">
        <div className="shield-stat"><span>星球护盾</span><div><i style={{ width: `${shield}%` }} /></div><b>{shield}%</b></div>
        <div className="wave-stat"><small>第 {props.wave} 波</small><strong>{props.timeLeft}<em>s</em></strong></div>
        <div className="score-stat"><small>守卫积分</small><strong>{props.score}</strong></div>
      </div>
      {props.status === "playing" && <div className="three-dom-word" aria-live="polite" aria-label={`目标单词 ${props.word}`}>
        {props.word.split("").map((character, index) => <span className={index < props.typedLength ? "done" : index === props.typedLength ? "current" : ""} key={index}>{character === " " ? "·" : character}</span>)}
      </div>}
      {props.status === "ready" ? (
        <div className="arena-intro"><span className="arena-kicker">3D 星球守卫战</span><h2>键盘就是你的能量炮</h2><p>看准陨石上的字母，按对即可发射光束。移动鼠标还能观察星球。</p><button className="arena-start" onClick={props.onStart}>开始守卫 <span>→</span></button><small>按 Enter 也可以开始</small></div>
      ) : (
        <div className="arena-actionbar"><span>下一键 <kbd>{props.target === " " ? "空格" : props.target.toUpperCase()}</kbd></span><p>{props.hint}</p><button className="arena-exit" onClick={props.onExit}>暂停退出</button></div>
      )}
      <span className="arena-crosshair" aria-hidden="true"><i /><i /></span>
    </div>
  );
}
