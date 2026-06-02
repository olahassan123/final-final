import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial, Sphere } from '@react-three/drei'
import { useRef, useMemo } from 'react'

function GlowSphere({ position, scale, color, distort = 0.4, speed = 1.5 }) {
  return (
    <Float speed={speed} rotationIntensity={0.5} floatIntensity={2}>
      <Sphere args={[1, 64, 64]} position={position} scale={scale}>
        <MeshDistortMaterial
          color={color}
          metalness={0.5}
          roughness={0.1}
          distort={distort}
          speed={2}
          transparent
          opacity={0.75}
        />
      </Sphere>
    </Float>
  )
}

function SpinningRing({ position, scale, color }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    ref.current.rotation.x = clock.elapsedTime * 0.35
    ref.current.rotation.z = clock.elapsedTime * 0.18
  })
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <torusGeometry args={[1, 0.22, 16, 80]} />
      <meshStandardMaterial color={color} metalness={0.95} roughness={0.04} transparent opacity={0.65} />
    </mesh>
  )
}

function DustParticles({ count = 130 }) {
  const ref = useRef()
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 22
      arr[i * 3 + 1] = (Math.random() - 0.5) * 22
      arr[i * 3 + 2] = (Math.random() - 0.5) * 12
    }
    return arr
  }, [count])

  useFrame(({ clock }) => {
    ref.current.rotation.y = clock.elapsedTime * 0.014
    ref.current.rotation.x = clock.elapsedTime * 0.006
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.07} color="#C4795A" transparent opacity={0.65} sizeAttenuation />
    </points>
  )
}

export default function FloatingScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 65 }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[8,  8, 5]}  intensity={3} color="#C4795A" />
      <pointLight position={[-8,-8, 5]}  intensity={2} color="#c5a5e8" />
      <pointLight position={[0,  0, 8]}  intensity={1} color="#ffffff" />

      <GlowSphere position={[ 4,   2,  -4]} scale={2.0} color="#C4795A" distort={0.4} speed={1.2} />
      <GlowSphere position={[-3.5,-1,  -3]} scale={1.4} color="#d4b5f0" distort={0.5} speed={2.0} />
      <GlowSphere position={[ 1,  -3, -1.5]} scale={0.9} color="#f0c5d4" distort={0.6} speed={3.0} />
      <GlowSphere position={[-1,   3.5,-5]} scale={1.6} color="#b5c5e8" distort={0.3} speed={1.0} />
      <GlowSphere position={[ 2.5,-2,  -2]} scale={0.7} color="#e8d4b5" distort={0.7} speed={2.5} />

      <SpinningRing position={[-3.5, 2,  -3]} scale={0.9} color="#C4795A" />
      <SpinningRing position={[ 3,  -1.5,-4.5]} scale={0.7} color="#c5a5e8" />
      <SpinningRing position={[ 0.5, 3,  -6]}   scale={1.2} color="#f0d4b5" />

      <DustParticles count={130} />
    </Canvas>
  )
}
