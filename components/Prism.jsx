'use client'
import React, { useRef, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function lerp(a, b, t) { return a + (b - a) * t }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function remap(v, a, b, c, d) { return lerp(c, d, clamp((v - a) / (b - a), 0, 1)) }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t) }

// ── SCROLL PHASES ────────────────────────────────────────────────────────────
// 0.00 → 0.40  Prism2 growing (this component invisible)
// 0.40 → 0.65  X-break (this component invisible)
// 0.65 → 0.85  Prism assembles / fades in
// 0.85 → 1.00  Prism fully visible with scan + square animations

// ── Triangle geometry helpers ─────────────────────────────────────────────
function leftEdgePoint(t)   { return { x: lerp(0, -1, t),  y: lerp(1, -1, t) } }
function bottomEdgePoint(t) { return { x: lerp(-1, 1, t),  y: -1 } }

function createSection1(leftT, depth = 1) {
  const apex = { x: 0, y: 1 }, rb = { x: 1, y: -1 }
  const cl = leftEdgePoint(leftT), cb = bottomEdgePoint(1 - leftT)
  const h = depth / 2
  const v = new Float32Array([
    apex.x,apex.y,h,  rb.x,rb.y,h,  cb.x,cb.y,h,  cl.x,cl.y,h,
    apex.x,apex.y,-h, rb.x,rb.y,-h, cb.x,cb.y,-h, cl.x,cl.y,-h,
  ])
  const i = new Uint16Array([0,3,2, 0,2,1, 4,5,6, 4,6,7, 0,4,7, 0,7,3, 0,1,5, 0,5,4, 1,2,6, 1,6,5, 3,7,6, 3,6,2])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3))
  geo.setIndex(new THREE.BufferAttribute(i, 1))
  geo.computeVertexNormals()
  return geo
}

function createMiddleSection(topT, botT, depth = 1) {
  const tL = leftEdgePoint(topT), tB = bottomEdgePoint(1 - topT)
  const bL = leftEdgePoint(botT), bB = bottomEdgePoint(1 - botT)
  const h = depth / 2
  const v = new Float32Array([
    tL.x,tL.y,h, tB.x,tB.y,h, bB.x,bB.y,h, bL.x,bL.y,h,
    tL.x,tL.y,-h, tB.x,tB.y,-h, bB.x,bB.y,-h, bL.x,bL.y,-h,
  ])
  const i = new Uint16Array([0,3,2, 0,2,1, 4,5,6, 4,6,7, 0,4,7, 0,7,3, 3,7,6, 3,6,2, 0,1,5, 0,5,4, 1,2,6, 1,6,5])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3))
  geo.setIndex(new THREE.BufferAttribute(i, 1))
  geo.computeVertexNormals()
  return geo
}

function createSection4(leftT, depth = 1) {
  const lb = { x: -1, y: -1 }
  const cl = leftEdgePoint(leftT), cb = bottomEdgePoint(1 - leftT)
  const h = depth / 2
  const v = new Float32Array([cl.x,cl.y,h, cb.x,cb.y,h, lb.x,lb.y,h, cl.x,cl.y,-h, cb.x,cb.y,-h, lb.x,lb.y,-h])
  const i = new Uint16Array([0,2,1, 3,4,5, 0,3,5, 0,5,2, 2,5,4, 2,4,1, 0,1,4, 0,4,3])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3))
  geo.setIndex(new THREE.BufferAttribute(i, 1))
  geo.computeVertexNormals()
  return geo
}

function createBottomFace(depth = 1) {
  const h = depth / 2
  const v = new Float32Array([-1,-1,h, 1,-1,h, 1,-1,-h, -1,-1,-h])
  const i = new Uint16Array([0,1,2, 0,2,3])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3))
  geo.setIndex(new THREE.BufferAttribute(i, 1))
  geo.computeVertexNormals()
  return geo
}

function makeDynamicGeo() {
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(12)
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2, 0,2,3]), 1))
  return geo
}

export default function Prism({ scrollProgress = 0 }) {
  const matcap = useTexture('/matcap.png')

  const groupRef    = useRef()
  const seg1Ref     = useRef()
  const seg2Ref     = useRef()
  const seg3Ref     = useRef()
  const seg4Ref     = useRef()
  const scanRef     = useRef()
  const bottomRef   = useRef()
  const squarePlaneRef = useRef()

  const sliceGeos     = useMemo(() => [
    createSection1(0.25, 1),
    createMiddleSection(0.25, 0.5, 1),
    createMiddleSection(0.5, 0.75, 1),
    createSection4(0.75, 1),
  ], [])
  const bottomFaceGeo  = useMemo(() => createBottomFace(1), [])
  const scanPlaneGeo   = useMemo(() => makeDynamicGeo(), [])
  const squarePlaneGeo = useMemo(() => makeDynamicGeo(), [])

  const segTargets = useMemo(() => [
    { posX: 0,    posY: 0 },
    { posX: -0.2, posY: 0.4 },
    { posX: 0.2,  posY: -0.4 },
    { posX: 0,    posY: 0 },
  ], [])

  useFrame((state) => {
    const time = state.clock.elapsedTime

    // Phase timings matching Prism2
    const assembleT = easeOutExpo(remap(scrollProgress, 0.65, 0.90, 0, 1))
    const fullyIn   = remap(scrollProgress, 0.85, 1.0, 0, 1)

    // Prism group only visible from scroll 0.65+
    if (groupRef.current) {
      groupRef.current.visible = scrollProgress >= 0.63

      if (scrollProgress >= 0.63) {
        // Assemble: scale up from small + gentle float once assembled
        const s = lerp(0.3, 1.2, assembleT)
        groupRef.current.scale.set(s, s, s)

        // Gentle float only after fully assembled
        groupRef.current.rotation.y = Math.sin(time * 0.3) * 0.05 * fullyIn
        groupRef.current.rotation.x = Math.sin(time * 0.2) * 0.03 * fullyIn
      }
    }

    // Slice separation — spreads as it assembles
    const segRefs = [seg1Ref, seg2Ref, seg3Ref, seg4Ref]
    segRefs.forEach((ref, i) => {
      if (!ref.current) return
      const t = segTargets[i]
      const sep = easeInOutCubic(fullyIn)
      ref.current.position.x = lerp(0, t.posX, sep)
      ref.current.position.y = lerp(0, t.posY, sep)

      // Fade in during assemble
      if (ref.current.material) {
        ref.current.material.opacity = clamp(assembleT * 1.4, 0, 0.92)
      }
    })

    // ── Pink scanning plane: sweeps apex → base, BOLD and clear ─────────────
    if (scanRef.current) {
      // Slow ping-pong oscillation
      const raw   = (Math.sin(time * 0.6 - Math.PI / 2) + 1) / 2
      const scanT = easeInOutCubic(raw)

      const cL  = leftEdgePoint(scanT)
      const cB  = bottomEdgePoint(1 - scanT)
      const hd  = 0.53

      const pos = scanRef.current.geometry.attributes.position
      pos.setXYZ(0, cL.x, cL.y,  hd)
      pos.setXYZ(1, cB.x, cB.y,  hd)
      pos.setXYZ(2, cB.x, cB.y, -hd)
      pos.setXYZ(3, cL.x, cL.y, -hd)
      pos.needsUpdate = true
      scanRef.current.geometry.computeVertexNormals()

      // Brighter and clearer — opacity 0.45-0.65
      const baseAlpha = 0.45 + Math.sin(time * 0.6) * 0.10
      scanRef.current.material.opacity = baseAlpha * assembleT
    }

    // ── Expanding square projection plane: grows small at apex → large at base
    if (squarePlaneRef.current) {
      const raw = (Math.sin(time * 0.45) + 1) / 2
      const sqT = easeInOutCubic(raw)
      const hw  = lerp(0.02, 1.08, sqT)
      const y   = lerp(1.0, -1.0, sqT)
      const hd  = lerp(0.02, 0.53, sqT)

      const pos = squarePlaneRef.current.geometry.attributes.position
      pos.setXYZ(0, -hw, y,  hd)
      pos.setXYZ(1,  hw, y,  hd)
      pos.setXYZ(2,  hw, y, -hd)
      pos.setXYZ(3, -hw, y, -hd)
      pos.needsUpdate = true

      // Clear vivid blue — opacity 0.35-0.55
      squarePlaneRef.current.material.opacity = (0.35 + sqT * 0.15) * assembleT
    }

    // ── Bottom face glow ───────────────────────────────────────────────────
    if (bottomRef.current) {
      const pulse = (Math.sin(time * 0.8) + 1) / 2
      bottomRef.current.material.opacity = (0.18 + pulse * 0.28) * assembleT
      bottomRef.current.material.color.setRGB(0.4 + pulse * 0.3, 0.6 + pulse * 0.2, 1.0)
    }
  })

  return (
    <group ref={groupRef} scale={[1.2, 1.2, 1.2]} visible={false}>

      {/* 4 slices */}
      <mesh ref={seg1Ref} geometry={sliceGeos[0]}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={seg2Ref} geometry={sliceGeos[1]}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={seg3Ref} geometry={sliceGeos[2]}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={seg4Ref} geometry={sliceGeos[3]}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>

      {/* Pink scan plane — BOLD, sweeps apex → base */}
      <mesh ref={scanRef} geometry={scanPlaneGeo} renderOrder={2}>
        <meshBasicMaterial
          color={0xff40b0}
          transparent opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Expanding square projection plane — vivid cyan-blue */}
      <mesh ref={squarePlaneRef} geometry={squarePlaneGeo} renderOrder={3}>
        <meshBasicMaterial
          color={0x40d0ff}
          transparent opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Bottom face glow */}
      <mesh ref={bottomRef} geometry={bottomFaceGeo} renderOrder={1}>
        <meshBasicMaterial
          color={0x66aaff}
          transparent opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

    </group>
  )
}
