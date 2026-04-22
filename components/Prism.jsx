'use client'
import React, { useRef, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function lerp(a, b, t) { return a + (b - a) * t }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function remap(v, a, b, c, d) { return lerp(c, d, clamp((v - a) / (b - a), 0, 1)) }

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

// ── Triangle geometry helpers ──────────────────────────────────────────────
function leftEdgePoint(t)   { return { x: lerp(0, -1, t), y: lerp(1, -1, t) } }
function bottomEdgePoint(t) { return { x: lerp(-1, 1, t), y: -1 } }

function createSection1(leftT, depth = 1) {
  const apex = { x: 0, y: 1 }
  const rightBase = { x: 1, y: -1 }
  const cutLeft   = leftEdgePoint(leftT)
  const cutBottom = bottomEdgePoint(1 - leftT)
  const h = depth / 2
  const verts = new Float32Array([
    apex.x, apex.y, h,        rightBase.x, rightBase.y, h,
    cutBottom.x, cutBottom.y, h, cutLeft.x, cutLeft.y, h,
    apex.x, apex.y, -h,       rightBase.x, rightBase.y, -h,
    cutBottom.x, cutBottom.y, -h, cutLeft.x, cutLeft.y, -h,
  ])
  const idx = new Uint16Array([0,3,2, 0,2,1, 4,5,6, 4,6,7, 0,4,7, 0,7,3, 0,1,5, 0,5,4, 1,2,6, 1,6,5, 3,7,6, 3,6,2])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  geo.computeVertexNormals()
  return geo
}

function createMiddleSection(topT, botT, depth = 1) {
  const tL = leftEdgePoint(topT),   tB = bottomEdgePoint(1 - topT)
  const bL = leftEdgePoint(botT),   bB = bottomEdgePoint(1 - botT)
  const h = depth / 2
  const verts = new Float32Array([
    tL.x,tL.y,h, tB.x,tB.y,h, bB.x,bB.y,h, bL.x,bL.y,h,
    tL.x,tL.y,-h, tB.x,tB.y,-h, bB.x,bB.y,-h, bL.x,bL.y,-h,
  ])
  const idx = new Uint16Array([0,3,2, 0,2,1, 4,5,6, 4,6,7, 0,4,7, 0,7,3, 3,7,6, 3,6,2, 0,1,5, 0,5,4, 1,2,6, 1,6,5])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  geo.computeVertexNormals()
  return geo
}

function createSection4(leftT, depth = 1) {
  const lb = { x: -1, y: -1 }
  const cl = leftEdgePoint(leftT), cb = bottomEdgePoint(1 - leftT)
  const h = depth / 2
  const verts = new Float32Array([cl.x,cl.y,h, cb.x,cb.y,h, lb.x,lb.y,h, cl.x,cl.y,-h, cb.x,cb.y,-h, lb.x,lb.y,-h])
  const idx  = new Uint16Array([0,2,1, 3,4,5, 0,3,5, 0,5,2, 2,5,4, 2,4,1, 0,1,4, 0,4,3])
  const geo  = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  geo.computeVertexNormals()
  return geo
}

function createBottomFace(depth = 1) {
  const h = depth / 2
  const verts = new Float32Array([-1,-1,h, 1,-1,h, 1,-1,-h, -1,-1,-h])
  const idx   = new Uint16Array([0,1,2, 0,2,3])
  const geo   = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  geo.computeVertexNormals()
  return geo
}

// ── Scan plane (updated per frame) ────────────────────────────────────────
function makeScanPlaneGeo() {
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(12)
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2, 0,2,3]), 1))
  return geo
}

// ── Projection lines from apex ─────────────────────────────────────────────
function makeProjectionLinesGeo() {
  const apex = new THREE.Vector3(0, 1, 0)
  // Lines projecting outward — like a frustum / camera view volume
  const targets = [
    new THREE.Vector3(-2.5, -2.5,  0.6),
    new THREE.Vector3( 2.5, -2.5,  0.6),
    new THREE.Vector3(-2.5, -2.5, -0.6),
    new THREE.Vector3( 2.5, -2.5, -0.6),
    new THREE.Vector3( 0,   -2.5,  1.2),
    new THREE.Vector3( 0,   -2.5, -1.2),
    new THREE.Vector3(-1.5, -2.5,  0),
    new THREE.Vector3( 1.5, -2.5,  0),
  ]
  const positions = []
  targets.forEach(t => { positions.push(apex.x, apex.y, apex.z, t.x, t.y, t.z) })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geo
}

// ── Square projection planes (the expanding squares from apex to base) ─────
// At t=0: tiny quad at apex; at t=1: full quad at base
function makeSquarePlaneGeo() {
  const geo = new THREE.BufferGeometry()
  // 4 corners of the expanding square, will be updated per frame
  const pos = new Float32Array(12) // 4 verts × 3
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2, 0,2,3]), 1))
  return geo
}

// ── Fragment data for break-apart animation ────────────────────────────────
// 6 triangular shards that fly outward
const FRAGMENT_DATA = [
  { offset: new THREE.Vector3(-1.4,  1.2, 0.3), rotEnd: new THREE.Euler(0.8, 1.2, 0.4) },
  { offset: new THREE.Vector3( 1.6,  0.8,-0.4), rotEnd: new THREE.Euler(-0.6, 0.9, 0.5) },
  { offset: new THREE.Vector3(-0.5, -1.8, 0.6), rotEnd: new THREE.Euler(1.2,-0.8, 0.3) },
  { offset: new THREE.Vector3( 0.8, -1.5,-0.5), rotEnd: new THREE.Euler(-1.0, 1.1,-0.6) },
  { offset: new THREE.Vector3(-1.8, -0.4,-0.3), rotEnd: new THREE.Euler(0.5,-1.3, 0.8) },
  { offset: new THREE.Vector3( 1.2,  0.3, 0.7), rotEnd: new THREE.Euler(-0.7, 0.4,-1.0) },
]

export default function Prism({ scrollProgress = 0 }) {
  const matcap = useTexture('/matcap.png')

  const groupRef    = useRef()
  const seg1Ref     = useRef()
  const seg2Ref     = useRef()
  const seg3Ref     = useRef()
  const seg4Ref     = useRef()
  const scanRef     = useRef()
  const projRef     = useRef()
  const bottomRef   = useRef()
  const squarePlaneRef = useRef()
  const fragmentRefs = useRef(FRAGMENT_DATA.map(() => React.createRef()))

  // ── Static geometries ────────────────────────────────────────────────────
  const sliceGeos = useMemo(() => [
    createSection1(0.25, 1),
    createMiddleSection(0.25, 0.5, 1),
    createMiddleSection(0.5, 0.75, 1),
    createSection4(0.75, 1),
  ], [])

  const bottomFaceGeo   = useMemo(() => createBottomFace(1), [])
  const scanPlaneGeo    = useMemo(() => makeScanPlaneGeo(), [])
  const squarePlaneGeo  = useMemo(() => makeSquarePlaneGeo(), [])
  const projLinesGeo    = useMemo(() => makeProjectionLinesGeo(), [])

  // Fragment geometries — small triangular prism shards
  const fragmentGeos = useMemo(() => FRAGMENT_DATA.map((_, i) => {
    return createSection1(0.2 + i * 0.08, 0.3)
  }), [])

  const segTargets = useMemo(() => [
    { posX: 0,    posY: 0 },
    { posX: -0.2, posY: 0.4 },
    { posX: 0.2,  posY: -0.4 },
    { posX: 0,    posY: 0 },
  ], [])

  useFrame((state) => {
    const time = state.clock.elapsedTime

    // ── Phase detection ────────────────────────────────────────────────────
    // 0.00 → 0.50 : View 1 fully visible
    // 0.50 → 0.70 : Break-apart transition
    // 0.70 → 1.00 : Fragments reassembling (Prism2 taking over)
    const phase1 = remap(scrollProgress, 0, 0.50, 0, 1)    // 0→1 during view1
    const breakT = remap(scrollProgress, 0.50, 0.70, 0, 1)  // 0→1 during break
    const phase2 = remap(scrollProgress, 0.70, 1.00, 0, 1)  // 0→1 during view2

    // ── Gentle float for whole group (view 1 only) ─────────────────────────
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(time * 0.3) * 0.05 * (1 - breakT)
      groupRef.current.rotation.x = Math.sin(time * 0.2) * 0.03 * (1 - breakT)

      // During break: group drifts back slightly
      groupRef.current.position.z = lerp(0, -1, easeInOutCubic(breakT))
      // After break: fade out entirely
      groupRef.current.visible = scrollProgress < 0.72
    }

    const segRefs = [seg1Ref, seg2Ref, seg3Ref, seg4Ref]

    // ── Slice separation (original animation) ─────────────────────────────
    segRefs.forEach((ref, i) => {
      if (!ref.current) return
      const t = segTargets[i]
      // Normal separation on phase1
      ref.current.position.x = lerp(0, t.posX, easeInOutCubic(phase1))
      ref.current.position.y = lerp(0, t.posY, easeInOutCubic(phase1))

      // During break-apart: scatter outward
      if (breakT > 0) {
        const frag = FRAGMENT_DATA[i % FRAGMENT_DATA.length]
        const bt   = easeOutExpo(breakT)
        ref.current.position.x += lerp(0, frag.offset.x * 0.6, bt)
        ref.current.position.y += lerp(0, frag.offset.y * 0.6, bt)
        ref.current.position.z  = lerp(0, frag.offset.z * 0.4, bt)
        ref.current.rotation.x  = lerp(0, frag.rotEnd.x * 0.5, bt)
        ref.current.rotation.y  = lerp(0, frag.rotEnd.y * 0.5, bt)
        // Fade out slices as they scatter
        if (ref.current.material) {
          ref.current.material.opacity = lerp(0.9, 0, bt * bt)
        }
      }
    })

    // ── Scan plane: sweeps from apex (t=0) to base (t=1) ──────────────────
    // Only during phase1; hides on break
    if (scanRef.current) {
      const raw   = (Math.sin(time * 0.7 - Math.PI / 2) + 1) / 2
      const scanT = easeInOutCubic(raw)
      const cL    = leftEdgePoint(scanT)
      const cB    = bottomEdgePoint(1 - scanT)
      const hd    = 0.52

      const pos = scanRef.current.geometry.attributes.position
      pos.setXYZ(0, cL.x,  cL.y,   hd)
      pos.setXYZ(1, cB.x,  cB.y,   hd)
      pos.setXYZ(2, cB.x,  cB.y,  -hd)
      pos.setXYZ(3, cL.x,  cL.y,  -hd)
      pos.needsUpdate = true
      scanRef.current.geometry.computeVertexNormals()
      scanRef.current.material.opacity = (0.18 + Math.sin(time * 0.7) * 0.07) * (1 - breakT)
    }

    // ── Expanding square planes from apex → base ───────────────────────────
    // Shows the "square projection plane growing from small to big" from the images
    if (squarePlaneRef.current) {
      const raw = (Math.sin(time * 0.5) + 1) / 2
      const sqT = easeInOutCubic(raw) // 0 = apex, 1 = base
      // Square half-width scales with sqT
      const hw  = lerp(0.02, 1.05, sqT)
      const y   = lerp(1, -1, sqT)   // moves from top to bottom
      const hd  = lerp(0.02, 0.52, sqT) // depth also scales

      const pos = squarePlaneRef.current.geometry.attributes.position
      pos.setXYZ(0, -hw, y,  hd)
      pos.setXYZ(1,  hw, y,  hd)
      pos.setXYZ(2,  hw, y, -hd)
      pos.setXYZ(3, -hw, y, -hd)
      pos.needsUpdate = true

      squarePlaneRef.current.material.opacity =
        (0.15 + sqT * 0.15) * (1 - breakT)
    }

    // ── Projection lines ───────────────────────────────────────────────────
    if (projRef.current) {
      projRef.current.material.opacity =
        (0.08 + Math.abs(Math.sin(time * 0.4)) * 0.18) * (1 - breakT)
    }

    // ── Bottom face glow ───────────────────────────────────────────────────
    if (bottomRef.current) {
      const pulse = (Math.sin(time * 0.8) + 1) / 2
      bottomRef.current.material.opacity = (0.12 + pulse * 0.22) * (1 - breakT)
      bottomRef.current.material.color.setRGB(
        0.4 + pulse * 0.3,
        0.6 + pulse * 0.2,
        1.0
      )
    }

    // ── Extra fragment shards (the visible break-apart pieces) ─────────────
    fragmentRefs.current.forEach((ref, i) => {
      if (!ref.current) return
      const frag = FRAGMENT_DATA[i]
      const bt   = easeOutExpo(clamp(breakT, 0, 1))
      // Enter from center, fly outward
      ref.current.position.set(
        lerp(0, frag.offset.x * 1.4, bt),
        lerp(0, frag.offset.y * 1.4, bt),
        lerp(0, frag.offset.z * 1.0, bt)
      )
      ref.current.rotation.set(
        lerp(0, frag.rotEnd.x, bt),
        lerp(0, frag.rotEnd.y, bt),
        lerp(0, frag.rotEnd.z, bt)
      )
      // Visible only during break phase, fades to 0 as phase2 begins
      const fragOpacity = clamp(breakT * 3, 0, 1) * (1 - phase2)
      if (ref.current.material) {
        ref.current.material.opacity = fragOpacity
      }
    })
  })

  return (
    <group ref={groupRef} scale={[1.2, 1.2, 1.2]}>

      {/* 4 main slices */}
      <mesh ref={seg1Ref} geometry={sliceGeos[0]}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={seg2Ref} geometry={sliceGeos[1]}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={seg3Ref} geometry={sliceGeos[2]}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={seg4Ref} geometry={sliceGeos[3]}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Scanning pink plane — sweeps tip → base */}
      <mesh ref={scanRef} geometry={scanPlaneGeo} renderOrder={1}>
        <meshBasicMaterial
          color={0xff60c0} transparent opacity={0.22}
          side={THREE.DoubleSide} depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Expanding square projection plane — grows small → large as it descends */}
      <mesh ref={squarePlaneRef} geometry={squarePlaneGeo} renderOrder={2}>
        <meshBasicMaterial
          color={0x88ddff} transparent opacity={0.18}
          side={THREE.DoubleSide} depthWrite={false}
          blending={THREE.AdditiveBlending}
          wireframe={false}
        />
      </mesh>

      {/* Projection lines from apex outward */}
      <lineSegments ref={projRef} geometry={projLinesGeo} renderOrder={0}>
        <lineBasicMaterial
          color={0x88ccff} transparent opacity={0.15}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* Bottom face glow */}
      <mesh ref={bottomRef} geometry={bottomFaceGeo} renderOrder={1}>
        <meshBasicMaterial
          color={0x66aaff} transparent opacity={0.2}
          side={THREE.DoubleSide} depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Break-apart fragments — triangular shards */}
      {FRAGMENT_DATA.map((_, i) => (
        <mesh key={i} ref={fragmentRefs.current[i]} geometry={fragmentGeos[i]}>
          <meshMatcapMaterial
            matcap={matcap}
            transparent opacity={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

    </group>
  )
}
