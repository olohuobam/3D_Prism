

'use client'
import React, { useRef } from 'react'
import { useGLTF, MeshTransmissionMaterial } from '@react-three/drei'
import { DoubleSide } from 'three'

export default function Prism() {
  const { nodes } = useGLTF('/prism3.glb')

  return (
    <mesh geometry={nodes.Cube.geometry} scale={[0.6, .9, 0.6]}
      rotation={[0, Math.PI / 2, 0]}
      position={[1, 0, 0]}>
      <MeshTransmissionMaterial
        backside
        backsideThickness={0.15}
        samples={16}
        resolution={1024}
        transmission={1}
        thickness={0.3}
        chromaticAberration={0.15}
        anisotropy={0.25}
        roughness={0}
        distortion={0.5}
        distortionScale={0.1}
        ior={1.25}
        color="white"
        side={DoubleSide}
      />
    </mesh>
  )
}

useGLTF.preload('/prism3.glb')
