'use client'
import React, { useRef, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Lerp helper
function lerp(a, b, t) {
  return a + (b - a) * t
}

// Ease function for smoother animation
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Triangle vertices
// Apex: (0, 1), Left base: (-1, -1), Right base: (1, -1)

function leftEdgePoint(t) {
  return { x: lerp(0, -1, t), y: lerp(1, -1, t) }
}

function bottomEdgePoint(t) {
  return { x: lerp(-1, 1, t), y: -1 }
}

function createSection1(leftT, depth = 1) {
  const apex = { x: 0, y: 1 }
  const rightBase = { x: 1, y: -1 }
  const cutLeft = leftEdgePoint(leftT)
  const cutBottom = bottomEdgePoint(1 - leftT)
  const halfDepth = depth / 2
  const vertices = new Float32Array([
    apex.x, apex.y, halfDepth,
    rightBase.x, rightBase.y, halfDepth,
    cutBottom.x, cutBottom.y, halfDepth,
    cutLeft.x, cutLeft.y, halfDepth,
    apex.x, apex.y, -halfDepth,
    rightBase.x, rightBase.y, -halfDepth,
    cutBottom.x, cutBottom.y, -halfDepth,
    cutLeft.x, cutLeft.y, -halfDepth,
  ])
  const indices = new Uint16Array([
    0, 3, 2, 0, 2, 1,
    4, 5, 6, 4, 6, 7,
    0, 4, 7, 0, 7, 3,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    3, 7, 6, 3, 6, 2,
  ])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  return geometry
}

function createMiddleSection(topLeftT, botLeftT, depth = 1) {
  const topLeft = leftEdgePoint(topLeftT)
  const topBottom = bottomEdgePoint(1 - topLeftT)
  const botLeft = leftEdgePoint(botLeftT)
  const botBottom = bottomEdgePoint(1 - botLeftT)
  const halfDepth = depth / 2
  const vertices = new Float32Array([
    topLeft.x, topLeft.y, halfDepth,
    topBottom.x, topBottom.y, halfDepth,
    botBottom.x, botBottom.y, halfDepth,
    botLeft.x, botLeft.y, halfDepth,
    topLeft.x, topLeft.y, -halfDepth,
    topBottom.x, topBottom.y, -halfDepth,
    botBottom.x, botBottom.y, -halfDepth,
    botLeft.x, botLeft.y, -halfDepth,
  ])
  const indices = new Uint16Array([
    0, 3, 2, 0, 2, 1,
    4, 5, 6, 4, 6, 7,
    0, 4, 7, 0, 7, 3,
    3, 7, 6, 3, 6, 2,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
  ])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  return geometry
}

function createSection4(leftT, depth = 1) {
  const leftBase = { x: -1, y: -1 }
  const cutLeft = leftEdgePoint(leftT)
  const cutBottom = bottomEdgePoint(1 - leftT)
  const halfDepth = depth / 2
  const vertices = new Float32Array([
    cutLeft.x, cutLeft.y, halfDepth,
    cutBottom.x, cutBottom.y, halfDepth,
    leftBase.x, leftBase.y, halfDepth,
    cutLeft.x, cutLeft.y, -halfDepth,
    cutBottom.x, cutBottom.y, -halfDepth,
    leftBase.x, leftBase.y, -halfDepth,
  ])
  const indices = new Uint16Array([
    0, 2, 1,
    3, 4, 5,
    0, 3, 5, 0, 5, 2,
    2, 5, 4, 2, 4, 1,
    0, 1, 4, 0, 4, 3,
  ])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  return geometry
}

// ─────────────────────────────────────────────
// ANIMATION 1: Pink Scanning Plane geometry
// A parallelogram-shaped plane that sweeps from apex to base
// At t=0 → tiny plane at apex, t=1 → full-width plane at base
// ─────────────────────────────────────────────
function createScanPlane(t, depth = 1.05) {
  // t: 0=apex, 1=base
  // Width of cut at parameter t (left edge → bottom edge)
  const cutLeft = leftEdgePoint(t)
  const cutBottom = bottomEdgePoint(1 - t)
  const halfDepth = depth / 2

  // The plane is a quad: cutLeft front, cutBottom front, cutBottom back, cutLeft back
  const vertices = new Float32Array([
    cutLeft.x,  cutLeft.y,  halfDepth,   // 0 front-left
    cutBottom.x, cutBottom.y, halfDepth, // 1 front-right
    cutBottom.x, cutBottom.y, -halfDepth,// 2 back-right
    cutLeft.x,  cutLeft.y,  -halfDepth,  // 3 back-left
  ])
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.computeVertexNormals()
  return geo
}

// ─────────────────────────────────────────────
// ANIMATION 3: Bottom face (base of prism) geometry
// The bottom edge of the triangle prism: a rectangle at y = -1
// ─────────────────────────────────────────────
function createBottomFace(depth = 1) {
  const halfDepth = depth / 2
  // Bottom face: rect from (-1,-1) to (1,-1) front/back
  const vertices = new Float32Array([
    -1, -1,  halfDepth,
     1, -1,  halfDepth,
     1, -1, -halfDepth,
    -1, -1, -halfDepth,
  ])
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.computeVertexNormals()
  return geo
}

export default function Prism({ scrollProgress = 0 }) {
  const matcap = useTexture('/matcap.png')

  const groupRef = useRef()
  const seg1Ref = useRef()
  const seg2Ref = useRef()
  const seg3Ref = useRef()
  const seg4Ref = useRef()

  // ── Animation 1: Scan plane refs ──
  const scanPlaneRef = useRef()
  const scanPlaneMeshRef = useRef()

  // ── Animation 3: Bottom face refs ──
  const bottomFaceRef = useRef()

  // ── Animation 2: Projection lines ──
  const projLinesRef = useRef()

  const sliceGeometries = useMemo(() => [
    createSection1(0.25, 1),
    createMiddleSection(0.25, 0.5, 1),
    createMiddleSection(0.5, 0.75, 1),
    createSection4(0.75, 1),
  ], [])

  // ── Animation 3: Bottom face geometry (static) ──
  const bottomFaceGeo = useMemo(() => createBottomFace(1), [])

  // ── Animation 2: Projection lines from apex vanishing point ──
  // Lines radiate from apex (0,1,0) outward through and past the prism
  const projLinesGeo = useMemo(() => {
    const apex = new THREE.Vector3(0, 1, 0)
    // 6 target points spread out beyond the prism base
    const targets = [
      new THREE.Vector3(-2.5, -2.5,  0.6),
      new THREE.Vector3( 2.5, -2.5,  0.6),
      new THREE.Vector3(-2.5, -2.5, -0.6),
      new THREE.Vector3( 2.5, -2.5, -0.6),
      new THREE.Vector3( 0,   -2.5,  1.2),
      new THREE.Vector3( 0,   -2.5, -1.2),
    ]
    const positions = []
    targets.forEach(t => {
      positions.push(apex.x, apex.y, apex.z)
      positions.push(t.x, t.y, t.z)
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [])

  const segmentTargets = useMemo(() => [
    { posX: 0, posY: 0 },
    { posX: -0.2, posY: 0.4 },
    { posX: 0.2, posY: -0.4 },
    { posX: 0, posY: 0 },
  ], [])

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const progress = easeInOutCubic(scrollProgress)

    // Gentle floating rotation of entire group
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(time * 0.3) * 0.05
      groupRef.current.rotation.x = Math.sin(time * 0.2) * 0.03
    }

    // Original slice animations
    const segmentRefs = [seg1Ref, seg2Ref, seg3Ref, seg4Ref]
    segmentRefs.forEach((ref, i) => {
      if (!ref.current) return
      const target = segmentTargets[i]
      ref.current.position.x = lerp(0, target.posX, progress)
      ref.current.position.y = lerp(0, target.posY, progress)
    })

    // ─────────────────────────────────────────
    // ANIMATION 1: Pink scanning plane
    // Oscillates t from 0 (apex) to 1 (base) and back
    // ─────────────────────────────────────────
    if (scanPlaneMeshRef.current) {
      // Slow ping-pong: t goes 0→1→0 over ~3 seconds
      const raw = (Math.sin(time * 0.7 - Math.PI / 2) + 1) / 2 // 0..1
      const scanT = easeInOutCubic(raw)

      // Rebuild plane geometry each frame at current t
      const cutLeft   = leftEdgePoint(scanT)
      const cutBottom = bottomEdgePoint(1 - scanT)
      const halfDepth = 0.52

      const pos = scanPlaneMeshRef.current.geometry.attributes.position
      // Front-left
      pos.setXYZ(0, cutLeft.x,   cutLeft.y,   halfDepth)
      // Front-right
      pos.setXYZ(1, cutBottom.x, cutBottom.y, halfDepth)
      // Back-right
      pos.setXYZ(2, cutBottom.x, cutBottom.y, -halfDepth)
      // Back-left
      pos.setXYZ(3, cutLeft.x,   cutLeft.y,  -halfDepth)
      pos.needsUpdate = true
      scanPlaneMeshRef.current.geometry.computeVertexNormals()

      // Fade opacity: slightly transparent at extremes, fuller in middle
      const mat = scanPlaneMeshRef.current.material
      mat.opacity = 0.18 + Math.sin(time * 0.7) * 0.07
    }

    // ─────────────────────────────────────────
    // ANIMATION 2: Projection lines fade in/out
    // Pulsing opacity radiating from apex
    // ─────────────────────────────────────────
    if (projLinesRef.current) {
      const mat = projLinesRef.current.material
      // Slow gentle pulse
      mat.opacity = 0.08 + Math.abs(Math.sin(time * 0.4)) * 0.18
    }

    // ─────────────────────────────────────────
    // ANIMATION 3: Bottom face glow pulse
    // The base face glows/pulses to "complete" the prism
    // ─────────────────────────────────────────
    if (bottomFaceRef.current) {
      const mat = bottomFaceRef.current.material
      // Breathing glow: slow pulse
      const pulse = (Math.sin(time * 0.8) + 1) / 2
      mat.opacity = 0.12 + pulse * 0.22
      // Slight emissive shift using color
      mat.color.setRGB(
        0.4 + pulse * 0.3,
        0.6 + pulse * 0.2,
        1.0
      )
    }
  })

  // Build initial scan plane geometry (will be updated each frame)
  const initialScanGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array([
      0, 1,  0.52,   // front-left (apex)
      0, 1,  0.52,   // front-right (same at start = tiny)
      0, 1, -0.52,   // back-right
      0, 1, -0.52,   // back-left
    ])
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2, 0,2,3]), 1))
    geo.computeVertexNormals()
    return geo
  }, [])

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={[1.2, 1.2, 1.2]}>

      {/* Original 4 slices */}
      <mesh ref={seg1Ref} geometry={sliceGeometries[0]}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={seg2Ref} geometry={sliceGeometries[1]}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={seg3Ref} geometry={sliceGeometries[2]}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={seg4Ref} geometry={sliceGeometries[3]}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* ── ANIMATION 1: Pink scanning plane ── */}
      {/* Sweeps from apex tip down to base and back */}
      <mesh ref={scanPlaneMeshRef} geometry={initialScanGeo} renderOrder={1}>
        <meshBasicMaterial
          color={0xff60c0}
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* ── ANIMATION 2: Projection lines from apex ── */}
      {/* Thin lines radiating outward from the apex vanishing point */}
      <lineSegments ref={projLinesRef} geometry={projLinesGeo} renderOrder={0}>
        <lineBasicMaterial
          color={0x88ccff}
          transparent
          opacity={0.15}
          linewidth={1}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* ── ANIMATION 3: Bottom face glow ── */}
      {/* The base edge of the prism pulses with a blue glow */}
      <mesh ref={bottomFaceRef} geometry={bottomFaceGeo} renderOrder={1}>
        <meshBasicMaterial
          color={0x66aaff}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

    </group>
  )
}
