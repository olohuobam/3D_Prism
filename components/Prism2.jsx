'use client'
import React, { useRef, useMemo } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function lerp(a, b, t) { return a + (b - a) * t }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function remap(v, a, b, c, d) { return lerp(c, d, clamp((v - a) / (b - a), 0, 1)) }
function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t) }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }

// ── SCROLL PHASES ──────────────────────────────────────────────────────────
// 0.00 → 0.45  Phase 1: meshA only (single prism) grows small → full
// 0.45 → 0.70  Phase 2: meshA slides UP-RIGHT, meshB fades in DOWN-LEFT (X break)
// 0.70 → 0.85  Both fade out
// 0.85 → 1.00  Phase 3: scan plane + square projection

export default function Prism2({ scrollProgress = 0, viewportWidth = 1024 }) {
  const meshARef       = useRef()
  const meshBRef       = useRef()
  const scanRef        = useRef()
  const squarePlaneRef = useRef()
  const bottomRef      = useRef()

  const gltf   = useGLTF('/prism3.glb')
  const matcap = useTexture('/matcap.png')

  // Responsive values derived from viewportWidth prop (from Three.js canvas size)
  const isMobile  = viewportWidth < 768
  const isSmall   = viewportWidth < 480

  // Scale multipliers per breakpoint
  const maxScale   = isSmall ? 0.70 : isMobile ? 0.82 : 1.0
  const breakMax   = isSmall ? 0.45 : isMobile ? 0.55 : 0.80

  const prismGeo = useMemo(() => {
    const first = Object.values(gltf.nodes).find(n => n.isMesh && n.geometry)
    return first?.geometry ?? null
  }, [gltf.nodes])

  const scanGeo = useRef((() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3))
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2,0,2,3]), 1))
    return geo
  })())

  const squareGeo = useRef((() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3))
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2,0,2,3]), 1))
    return geo
  })())

  const bottomFaceGeo = useMemo(() => {
    const h = 0.53
    const v = new Float32Array([-1,-1,h, 1,-1,h, 1,-1,-h, -1,-1,-h])
    const idx = new Uint16Array([0,1,2,0,2,3])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3))
    geo.setIndex(new THREE.BufferAttribute(idx, 1))
    geo.computeVertexNormals()
    return geo
  }, [])

  function leftEdgePoint(t)   { return { x: lerp(0, -1, t), y: lerp(1, -1, t) } }
  function bottomEdgePoint(t) { return { x: lerp(-1, 1, t), y: -1 } }

  useFrame((state) => {
    const time = state.clock.elapsedTime

    const growT  = easeOutExpo(remap(scrollProgress, 0,    0.45, 0, 1))
    const breakT = easeInOutCubic(remap(scrollProgress, 0.45, 0.70, 0, 1))
    const fadeT  = remap(scrollProgress, 0.70, 0.85, 0, 1)
    const phase3 = remap(scrollProgress, 0.70, 1.00, 0, 1)
    const p3ease = easeOutExpo(phase3)

    const baseScale = lerp(0.08, maxScale, growT)
    const breakDist = lerp(0, breakMax, breakT)
    const fadeOut   = clamp(1 - fadeT * 2, 0, 1)

    // ── meshA: single prism in phase 1, slides UP-RIGHT in phase 2 ─────────
    if (meshARef.current) {
      const opA = clamp(growT * 4, 0, 1) * fadeOut
      meshARef.current.visible = opA > 0.005
      meshARef.current.scale.set(0.6 * baseScale, 0.9 * baseScale, 0.6 * baseScale)
      meshARef.current.position.set(
        breakDist * 0.55,
        breakDist * 0.55,
        breakDist * 0.12
      )
      meshARef.current.rotation.set(
        breakT * 0.18,
        Math.PI / 2 + breakT * 0.14,
        breakT * 0.10
      )
      if (meshARef.current.material)
        meshARef.current.material.opacity = opA
    }

    // ── meshB: invisible in phase 1, fades in during phase 2, DOWN-LEFT ────
    if (meshBRef.current) {
      const opB = clamp(breakT * 3, 0, 1) * fadeOut
      meshBRef.current.visible = opB > 0.005
      meshBRef.current.scale.set(0.6 * baseScale, 0.9 * baseScale, 0.6 * baseScale)
      meshBRef.current.position.set(
        -breakDist * 0.55,
        -breakDist * 0.55,
        -breakDist * 0.12
      )
      meshBRef.current.rotation.set(
        -breakT * 0.18,
         Math.PI / 2 - breakT * 0.14,
        -breakT * 0.10
      )
      if (meshBRef.current.material)
        meshBRef.current.material.opacity = opB
    }

    // ── Phase 3: scan + square ─────────────────────────────────────────────
    const ps = 0.9 * baseScale

    if (scanRef.current) {
      const raw   = (Math.sin(time * 0.6 - Math.PI / 2) + 1) / 2
      const scanT = easeInOutCubic(raw)
      const cL    = leftEdgePoint(scanT)
      const cB    = bottomEdgePoint(1 - scanT)
      const hd    = 0.53
      const pos   = scanGeo.current.attributes.position
      pos.setXYZ(0, cL.x, cL.y,  hd); pos.setXYZ(1, cB.x, cB.y,  hd)
      pos.setXYZ(2, cB.x, cB.y, -hd); pos.setXYZ(3, cL.x, cL.y, -hd)
      pos.needsUpdate = true
      scanGeo.current.computeVertexNormals()
      scanRef.current.visible = phase3 > 0.01
      scanRef.current.scale.set(ps, ps, ps)
      scanRef.current.position.set(0, 0, 0)
      scanRef.current.material.opacity = (0.45 + Math.sin(time * 0.6) * 0.10) * p3ease
    }

    if (squarePlaneRef.current) {
      const raw = (Math.sin(time * 0.45) + 1) / 2
      const sqT = easeInOutCubic(raw)
      const hw  = lerp(0.02, 1.08, sqT)
      const y   = lerp(1.0, -1.0, sqT)
      const hd  = lerp(0.02, 0.53, sqT)
      const pos = squareGeo.current.attributes.position
      pos.setXYZ(0, -hw, y,  hd); pos.setXYZ(1,  hw, y,  hd)
      pos.setXYZ(2,  hw, y, -hd); pos.setXYZ(3, -hw, y, -hd)
      pos.needsUpdate = true
      squarePlaneRef.current.visible = phase3 > 0.01
      squarePlaneRef.current.scale.set(ps, ps, ps)
      squarePlaneRef.current.position.set(0, 0, 0)
      squarePlaneRef.current.material.opacity = (0.35 + sqT * 0.15) * p3ease
    }

    if (bottomRef.current) {
      const pulse = (Math.sin(time * 0.8) + 1) / 2
      bottomRef.current.visible = phase3 > 0.01
      bottomRef.current.scale.set(ps, ps, ps)
      bottomRef.current.position.set(0, 0, 0)
      bottomRef.current.material.opacity = (0.18 + pulse * 0.28) * p3ease
      bottomRef.current.material.color.setRGB(0.4 + pulse * 0.3, 0.6 + pulse * 0.2, 1.0)
    }
  })

  if (!prismGeo) return null

  return (
    <>
      <mesh ref={meshARef} geometry={prismGeo} visible={false}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={meshBRef} geometry={prismGeo} visible={false}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={scanRef} geometry={scanGeo.current} renderOrder={2} visible={false}>
        <meshBasicMaterial color={0xff40b0} transparent opacity={0}
          side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={squarePlaneRef} geometry={squareGeo.current} renderOrder={3} visible={false}>
        <meshBasicMaterial color={0x40d0ff} transparent opacity={0}
          side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={bottomRef} geometry={bottomFaceGeo} renderOrder={1} visible={false}>
        <meshBasicMaterial color={0x66aaff} transparent opacity={0}
          side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  )
}

useGLTF.preload('/prism3.glb')
