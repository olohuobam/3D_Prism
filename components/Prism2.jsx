'use client'
import React, { useRef, useEffect, useState } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function lerp(a, b, t) { return a + (b - a) * t }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function remap(v, a, b, c, d) { return lerp(c, d, clamp((v - a) / (b - a), 0, 1)) }
function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t) }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }

// ── SCROLL PHASES ─────────────────────────────────────────────────────────
// 0.00 → 0.40  Phase 1: ONE prism grows from small to full
// 0.40 → 0.65  Phase 2: Splits into X (A slides up-right, B slides down-left)
// 0.65 → 0.85  Phase 3: Both fade out, scan plane + square projection appear on it
// 0.85 → 1.00  Phase 3 full: scan + square fully active

// Resting transform — both pieces share this when t=0 (looks like ONE prism)
const REST_POS   = new THREE.Vector3(0, 0, 0)
const REST_ROT   = new THREE.Euler(0, Math.PI / 2, 0)
const REST_SCALE = new THREE.Vector3(0.6, 0.9, 0.6)

export default function Prism2({ scrollProgress = 0 }) {
  const meshARef       = useRef()   // upper piece
  const meshBRef       = useRef()   // lower piece
  const scanRef        = useRef()   // pink scan plane
  const squarePlaneRef = useRef()   // cyan square projection
  const bottomRef      = useRef()   // base glow

  const { nodes } = useGLTF('/prism3.glb')
  const matcap    = useTexture('/matcap.png')

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Dynamic geometries for scan + square planes ────────────────────────
  const scanGeo   = useRef((() => {
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

  function leftEdgePoint(t)   { return { x: lerp(0, -1, t), y: lerp(1, -1, t) } }
  function bottomEdgePoint(t) { return { x: lerp(-1, 1, t), y: -1 } }

  useFrame((state) => {
    const time = state.clock.elapsedTime
    if (!meshARef.current || !meshBRef.current) return

    // Phase progress values
    const growT  = easeOutExpo(remap(scrollProgress, 0,    0.40, 0, 1))
    const breakT = easeInOutCubic(remap(scrollProgress, 0.40, 0.65, 0, 1))
    const fadeT  = remap(scrollProgress, 0.65, 0.85, 0, 1)
    const phase3 = remap(scrollProgress, 0.65, 1.00, 0, 1)

    // ── Scale: tiny → full (SAME for both pieces = looks like one) ─────────
    const maxS      = isMobile ? 0.85 : 1.0
    const baseScale = lerp(0.08, maxS, growT)

    // ── Opacity: fade in with grow, fade out at phase 3 end ───────────────
    // During X-break both pieces are visible; they fade as phase3 scan takes over
    const prismOpacity = clamp(growT * 3, 0, 1) * clamp(1 - fadeT * 1.2, 0, 1)
    const show = prismOpacity > 0.005

    // ── X-break offset (0 when breakT=0 → perfectly overlapping = one prism)
    const breakDist = lerp(0, isMobile ? 0.60 : 0.80, breakT)

    // ── Piece A: resting pos + slides UP-RIGHT during break ───────────────
    meshARef.current.visible = show
    meshARef.current.position.set(
      REST_POS.x + breakDist * 0.55,
      REST_POS.y + breakDist * 0.55,
      REST_POS.z + breakDist * 0.12
    )
    meshARef.current.rotation.set(
      REST_ROT.x + breakT * 0.18,
      REST_ROT.y + breakT * 0.14,
      REST_ROT.z + breakT * 0.10
    )
    meshARef.current.scale.set(
      REST_SCALE.x * baseScale,
      REST_SCALE.y * baseScale,
      REST_SCALE.z * baseScale
    )
    if (meshARef.current.material)
      meshARef.current.material.opacity = prismOpacity

    // ── Piece B: resting pos + slides DOWN-LEFT during break ──────────────
    meshBRef.current.visible = show
    meshBRef.current.position.set(
      REST_POS.x - breakDist * 0.55,
      REST_POS.y - breakDist * 0.55,
      REST_POS.z - breakDist * 0.12
    )
    meshBRef.current.rotation.set(
      REST_ROT.x - breakT * 0.18,
      REST_ROT.y - breakT * 0.14,
      REST_ROT.z - breakT * 0.10
    )
    meshBRef.current.scale.set(
      REST_SCALE.x * baseScale,
      REST_SCALE.y * baseScale,
      REST_SCALE.z * baseScale
    )
    if (meshBRef.current.material)
      meshBRef.current.material.opacity = prismOpacity

    // ── Phase 3: scan plane + square projection on the prism ──────────────
    const p3ease = easeOutExpo(phase3)

    // Pink scan plane — sweeps apex→base
    if (scanRef.current) {
      const raw   = (Math.sin(time * 0.6 - Math.PI / 2) + 1) / 2
      const scanT = easeInOutCubic(raw)
      const cL = leftEdgePoint(scanT)
      const cB = bottomEdgePoint(1 - scanT)
      const hd = 0.53

      const pos = scanGeo.current.attributes.position
      pos.setXYZ(0, cL.x, cL.y,  hd)
      pos.setXYZ(1, cB.x, cB.y,  hd)
      pos.setXYZ(2, cB.x, cB.y, -hd)
      pos.setXYZ(3, cL.x, cL.y, -hd)
      pos.needsUpdate = true
      scanGeo.current.computeVertexNormals()

      scanRef.current.visible = phase3 > 0.01
      // Scale and position to match the grown prism
      const ps = REST_SCALE.y * baseScale * (isMobile ? 0.85 : 1.0)
      scanRef.current.scale.set(ps, ps, ps)
      scanRef.current.position.set(REST_POS.x, REST_POS.y, REST_POS.z)
      scanRef.current.material.opacity = (0.45 + Math.sin(time * 0.6) * 0.10) * p3ease
    }

    // Cyan square projection plane
    if (squarePlaneRef.current) {
      const raw = (Math.sin(time * 0.45) + 1) / 2
      const sqT = easeInOutCubic(raw)
      const hw  = lerp(0.02, 1.08, sqT)
      const y   = lerp(1.0, -1.0, sqT)
      const hd  = lerp(0.02, 0.53, sqT)

      const pos = squareGeo.current.attributes.position
      pos.setXYZ(0, -hw, y,  hd)
      pos.setXYZ(1,  hw, y,  hd)
      pos.setXYZ(2,  hw, y, -hd)
      pos.setXYZ(3, -hw, y, -hd)
      pos.needsUpdate = true

      squarePlaneRef.current.visible = phase3 > 0.01
      const ps = REST_SCALE.y * baseScale * (isMobile ? 0.85 : 1.0)
      squarePlaneRef.current.scale.set(ps, ps, ps)
      squarePlaneRef.current.position.set(REST_POS.x, REST_POS.y, REST_POS.z)
      squarePlaneRef.current.material.opacity = (0.35 + sqT * 0.15) * p3ease
    }

    // Base glow
    if (bottomRef.current) {
      const pulse = (Math.sin(time * 0.8) + 1) / 2
      bottomRef.current.visible = phase3 > 0.01
      const ps = REST_SCALE.y * baseScale * (isMobile ? 0.85 : 1.0)
      bottomRef.current.scale.set(ps, ps, ps)
      bottomRef.current.position.set(REST_POS.x, REST_POS.y, REST_POS.z)
      bottomRef.current.material.opacity = (0.18 + pulse * 0.28) * p3ease
      bottomRef.current.material.color.setRGB(0.4 + pulse * 0.3, 0.6 + pulse * 0.2, 1.0)
    }
  })

  // Bottom face geometry for the base glow
  const bottomFaceGeo = React.useMemo(() => {
    const h = 0.53
    const v = new Float32Array([-1,-1,h, 1,-1,h, 1,-1,-h, -1,-1,-h])
    const i = new Uint16Array([0,1,2,0,2,3])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3))
    geo.setIndex(new THREE.BufferAttribute(i, 1))
    geo.computeVertexNormals()
    return geo
  }, [])

  return (
    <>
      {/* Piece A — starts identical to B, splits up-right on break */}
      <mesh ref={meshARef} geometry={nodes.Cube.geometry} visible={false}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>

      {/* Piece B — starts identical to A, splits down-left on break */}
      <mesh ref={meshBRef} geometry={nodes.Cube.geometry} visible={false}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>

      {/* Pink scan plane — phase 3 only */}
      <mesh ref={scanRef} geometry={scanGeo.current} renderOrder={2} visible={false}>
        <meshBasicMaterial
          color={0xff40b0} transparent opacity={0}
          side={THREE.DoubleSide} depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Cyan square projection plane — phase 3 only */}
      <mesh ref={squarePlaneRef} geometry={squareGeo.current} renderOrder={3} visible={false}>
        <meshBasicMaterial
          color={0x40d0ff} transparent opacity={0}
          side={THREE.DoubleSide} depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Base glow — phase 3 only */}
      <mesh ref={bottomRef} geometry={bottomFaceGeo} renderOrder={1} visible={false}>
        <meshBasicMaterial
          color={0x66aaff} transparent opacity={0}
          side={THREE.DoubleSide} depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  )
}

useGLTF.preload('/prism3.glb')
