'use client'
import React, { useRef } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function lerp(a, b, t) { return a + (b - a) * t }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function remap(v, a, b, c, d) { return lerp(c, d, clamp((v - a) / (b - a), 0, 1)) }

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// The final assembled prism appears as phase2 (scroll 0.65→1.0) progresses.
// It starts scattered (large offset, scattered rotation) and converges
// to its resting position — giving the "breaking before joining" effect.

export default function Prism2({ scrollProgress = 0 }) {
  const meshRef = useRef()
  const { nodes } = useGLTF('/prism3.glb')
  const matcap = useTexture('/matcap.png')

  // phase2: 0 at scroll=0.65, 1 at scroll=1.0
  // breakT: how far into the break (0.50→0.70)
  const phase2 = remap(scrollProgress, 0.65, 1.0, 0, 1)
  const breakT = remap(scrollProgress, 0.50, 0.70, 0, 1)

  useFrame(() => {
    if (!meshRef.current) return

    const assembleT = easeOutExpo(clamp(phase2, 0, 1))

    // Invisible until break phase is well underway
    const visible = scrollProgress >= 0.62
    meshRef.current.visible = visible

    if (!visible) return

    // Start scattered far away, converge to final position
    // "Assembles" like pieces flying inward to form the shape
    const scatterT = 1 - assembleT

    // Position: comes in from slight offset
    meshRef.current.position.x = lerp(-1 + scatterT * 1.5, -1, assembleT)
    meshRef.current.position.y = lerp(0  + scatterT * 0.8,  0, assembleT)
    meshRef.current.position.z = lerp(0  - scatterT * 2.0,  0, assembleT)

    // Rotation: spins in to final rotation
    meshRef.current.rotation.y = lerp(
      Math.PI / 2 + scatterT * Math.PI * 1.5,
      Math.PI / 2,
      assembleT
    )
    meshRef.current.rotation.x = lerp(scatterT * 0.8, 0, assembleT)
    meshRef.current.rotation.z = lerp(scatterT * 0.5, 0, assembleT)

    // Scale: starts slightly small, pops to full
    const scaleBase = lerp(0.3, 1, assembleT)
    const scaleWobble = 1 + Math.sin(assembleT * Math.PI) * 0.08 * (1 - assembleT)
    const s = scaleBase * scaleWobble
    meshRef.current.scale.set(0.6 * s, 0.9 * s, 0.6 * s)

    // Opacity: fades in as it assembles
    if (meshRef.current.material) {
      meshRef.current.material.opacity = clamp(assembleT * 1.5, 0, 1)
    }
  })

  return (
    <mesh
      ref={meshRef}
      geometry={nodes.Cube.geometry}
      scale={[0.6, 0.9, 0.6]}
      rotation={[0, Math.PI / 2, 0]}
      position={[-1, 0, 0]}
      visible={false}
    >
      <meshMatcapMaterial
        matcap={matcap}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

useGLTF.preload('/prism3.glb')
