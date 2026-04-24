'use client'
import { Environment } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import React, { useEffect, useState, useCallback } from 'react'
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

// Lives inside Canvas — reads real viewport size from Three.js
function ResponsiveCameraAndScene({ scrollProgress }) {
  const { camera, size } = useThree()

  // Recalculate on every size change
  useEffect(() => {
    const w = size.width
    if (w < 480) {
      camera.fov = 75
      camera.position.set(0, 0, 7)
    } else if (w < 768) {
      camera.fov = 65
      camera.position.set(0, 0, 6)
    } else {
      camera.fov = 45
      camera.position.set(0, 0, 5)
    }
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])

  // Pass real canvas width into Prism2 so it can scale correctly
  return <Prism2 scrollProgress={scrollProgress} viewportWidth={size.width} />
}

const Scene = () => {
  const [scrollProgress, setScrollProgress] = useState(0)
  const handleScroll = useCallback((p) => setScrollProgress(p), [])

  return (
    <>
      <ScrollTracker onScrollProgress={handleScroll} />
      <div className='scene-wrapper'>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 2]}
          style={{ width: '100%', height: '100%' }}
        >
          <color attach="background" args={['#0F021F']} />
          <ambientLight intensity={1} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <Environment preset='sunset' />
          <ResponsiveCameraAndScene scrollProgress={scrollProgress} />
        </Canvas>
      </div>
    </>
  )
}

export default Scene
