import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Props = {
  positions: Float32Array | null;
  indices: Uint32Array | null;
  colors?: Float32Array | null;
  original: Float32Array | null;
  showOriginal: boolean;
  diffOnly?: boolean;
  modelScale?: number;
};

export function Viewer({ positions, indices, colors = null, original, showOriginal, diffOnly = false, modelScale = 1 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const ghostRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-80, 80, 105, -105, -400, 800);
    camera.position.set(52, 128, 86);
    camera.lookAt(0, 94, 0);
    const fit = () => {
      const aspect = el.clientWidth / Math.max(el.clientHeight, 1);
      const viewH = 250;
      const viewW = viewH * aspect;
      camera.left = -viewW / 2;
      camera.right = viewW / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.position.set(52, 128, 86);
      camera.lookAt(0, 94, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    fit();
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 94, 0);
    controls.enableDamping = true;
    controls.update();
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0xc8b79a, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(-30, 40, 80);
    scene.add(key);
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.58, metalness: 0.06, side: THREE.DoubleSide, vertexColors: true }),
    );
    const ghost = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color: 0x8a847a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    scene.add(mesh, ghost);
    meshRef.current = mesh;
    ghostRef.current = ghost;
    let frame = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      mesh.geometry.dispose();
      ghost.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      (ghost.material as THREE.Material).dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !positions || !indices) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    if (colors && colors.length === positions.length) {
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
    geometry.computeVertexNormals();
    mesh.geometry.dispose();
    mesh.geometry = geometry;
    mesh.visible = !diffOnly;
  }, [positions, indices, colors, diffOnly]);

  useEffect(() => {
    const ghost = ghostRef.current;
    if (!ghost) return;
    ghost.visible = showOriginal && !!original;
    const material = ghost.material as THREE.MeshBasicMaterial;
    material.color.set(diffOnly ? 0xb42318 : 0x8a847a);
    material.wireframe = !!diffOnly;
    material.opacity = diffOnly ? 0.9 : 0.22;
    if (!original || !showOriginal) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(original, 3));
    ghost.geometry.dispose();
    ghost.geometry = geometry;
    ghost.scale.setScalar(modelScale);
  }, [original, showOriginal, modelScale, diffOnly]);

  return <div className="viewport" ref={host} />;
}
