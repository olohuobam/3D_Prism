'use client'
import React, { useRef } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function lerp(a, b, t) { return a + (b - a) * t }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function remap(v, a, b, c, d) { return lerp(c, d, clamp((v - a) / (b - a), 0, 1)) }
function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t) }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }

// ── SCROLL PHASES ────────────────────────────────────────────────────────────
// 0.00 → 0.40  Phase 1: Prism2 appears small, grows to full size
// 0.40 → 0.65  Phase 2: breaks into X-shape (two diagonal halves slide apart)
// 0.65 → 0.85  Phase 3: X pieces fade out → Prism scan plane assembles

export default function Prism2({ scrollProgress = 0 }) {
  const meshARef = useRef() // top-left piece of the X
  const meshBRef = useRef() // bottom-right piece of the X
  const { nodes } = useGLTF('/prism3.glb')
  const matcap = useTexture('/matcap.png')

  useFrame(() => {
    if (!meshARef.current || !meshBRef.current) return

    // Phase timings
    const growT  = easeOutExpo(remap(scrollProgress, 0, 0.40, 0, 1))
    const breakT = easeInOutCubic(remap(scrollProgress, 0.40, 0.65, 0, 1))
    const fadeT  = remap(scrollProgress, 0.65, 0.85, 0, 1)

    // Scale: tiny → full
    const baseScale = lerp(0.15, 1.0, growT)

    // X-break: pieces slide diagonally apart
    const breakDist = lerp(0, 0.85, breakT)

    // Opacity: fade in with grow, fade out during phase 3
    const opacity = clamp((1 - fadeT) * clamp(growT * 3, 0, 1), 0, 1)

    const show = opacity > 0.01

    // ── Piece A: slides UP-RIGHT ──────────────────────────────────────────
    meshARef.current.visible = show
    meshARef.current.scale.set(0.6 * baseScale, 0.9 * baseScale, 0.6 * baseScale)
    meshARef.current.position.set(
      -1 + breakDist * 0.6,
       0 + breakDist * 0.6,
       0 + breakDist * 0.15
    )
    meshARef.current.rotation.set(
       breakT * 0.18,
       Math.PI / 2 + breakT * 0.14,
       breakT * 0.10
    )
    if (meshARef.current.material) meshARef.current.material.opacity = opacity

    // ── Piece B: slides DOWN-LEFT ─────────────────────────────────────────
    meshBRef.current.visible = show
    meshBRef.current.scale.set(0.6 * baseScale, 0.9 * baseScale, 0.6 * baseScale)
    meshBRef.current.position.set(
      -1 - breakDist * 0.6,
       0 - breakDist * 0.6,
       0 - breakDist * 0.15
    )
    meshBRef.current.rotation.set(
      -breakT * 0.18,
       Math.PI / 2 - breakT * 0.14,
      -breakT * 0.10
    )
    if (meshBRef.current.material) meshBRef.current.material.opacity = opacity
  })

  return (
    <>
      <mesh ref={meshARef} geometry={nodes.Cube.geometry} visible={false}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={meshBRef} geometry={nodes.Cube.geometry} visible={false}>
        <meshMatcapMaterial matcap={matcap} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

useGLTF.preload('/prism3.glb')
