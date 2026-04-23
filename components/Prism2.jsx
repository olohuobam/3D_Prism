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

// ── SCROLL PHASES ────────────────────────────────────────────────────────────
// 0.00 → 0.40  Phase 1: grows from small to full
// 0.40 → 0.65  Phase 2: X-break — two halves slide diagonally apart
// 0.65 → 0.85  Phase 3: fade out → Prism takes over

export default function Prism2({ scrollProgress = 0 }) {
  const meshARef = useRef()
  const meshBRef = useRef()
  const { nodes } = useGLTF('/prism3.glb')
  const matcap = useTexture('/matcap.png')

  // Detect mobile for responsive offsets
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useFrame(() => {
    if (!meshARef.current || !meshBRef.current) return

    const growT  = easeOutExpo(remap(scrollProgress, 0, 0.40, 0, 1))
    const breakT = easeInOutCubic(remap(scrollProgress, 0.40, 0.65, 0, 1))
    const fadeT  = remap(scrollProgress, 0.65, 0.85, 0, 1)

    // Mobile: centered at x=0, desktop: offset to x=-1
    const centerX   = isMobile ? 0 : -1
    // Mobile: slightly smaller base scale
    const maxScale  = isMobile ? 0.85 : 1.0
    const baseScale = lerp(0.15, maxScale, growT)

    // X-break distance — tighter on mobile
    const breakDist = lerp(0, isMobile ? 0.65 : 0.85, breakT)

    const opacity = clamp((1 - fadeT) * clamp(growT * 3, 0, 1), 0, 1)
    const show    = opacity > 0.01

    // ── Piece A: slides UP-RIGHT ──────────────────────────────────────────
    meshARef.current.visible = show
    meshARef.current.scale.set(0.6 * baseScale, 0.9 * baseScale, 0.6 * baseScale)
    meshARef.current.position.set(
      centerX + breakDist * 0.6,
      0       + breakDist * 0.6,
      0       + breakDist * 0.15
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
      centerX - breakDist * 0.6,
      0       - breakDist * 0.6,
      0       - breakDist * 0.15
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
