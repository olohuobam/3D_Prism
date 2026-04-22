'use client'
import { Environment, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import React, { useEffect, useState, useCallback } from 'react'
import Prism from './Prism'
import Prism2 from './Prism2'

function ScrollTracker({ onScrollProgress }) {
  useEffect(() => {
    window.scrollTo(0, 0)
    onScrollProgress(0)

    const handleScroll = () => {
      const scrollY = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? Math.min(Math.max(scrollY / docHeight, 0), 1) : 0
      onScrollProgress(progress)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [onScrollProgress])

  return null
}

const Scene = () => {
  const [scrollProgress, setScrollProgress] = useState(0)
  const handleScroll = useCallback((p) => setScrollProgress(p), [])

  // Phase breakdown:
  // 0.00 → 0.45  : View 1 (Prism) — scanning plane + projection lines
  // 0.45 → 0.65  : Break transition — fragments fly apart
  // 0.65 → 1.00  : View 2 (Prism2) — assembles from fragments

  return (
    <>
      <ScrollTracker onScrollProgress={handleScroll} />
      <div className='scene-wrapper'>
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <color attach="background" args={['#0F021F']} />
          <ambientLight intensity={1} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <Environment preset='sunset' />
          <OrbitControls enableZoom={false} enableRotate={false} />
          <Prism scrollProgress={scrollProgress} />
          <Prism2 scrollProgress={scrollProgress} />
        </Canvas>
      </div>
    </>
  )
}

export default Scene
