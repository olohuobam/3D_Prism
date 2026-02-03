'use client'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Orbit } from 'next/font/google'
import React from 'react'
import Prism from './Prism'
import Prism2 from './Prism2'

const Scene = () => {
    return (
        <div className='w-full h-screen '>
            <Canvas
                camera={{ position: [0, 0, 5], fov: 45 }}
            >
                <color attach="background" args={['#0F021F']} />
                <ambientLight intensity={1} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <Environment preset='sunset' />
                <OrbitControls />
                <Prism />
                <Prism2 />
            </Canvas>
        </div>
    )
}

export default Scene