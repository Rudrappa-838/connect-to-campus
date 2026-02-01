import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Sphere, MeshDistortMaterial } from '@react-three/drei'
import { useRef } from 'react'

function AnimatedSphere() {
    const sphereRef = useRef()

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime()
        if (sphereRef.current) {
            sphereRef.current.rotation.y = t * 0.1
            sphereRef.current.rotation.z = t * 0.05
        }
    })

    return (
        <Sphere visible args={[1, 100, 200]} scale={2.4} ref={sphereRef}>
            <MeshDistortMaterial
                color="#3b82f6"
                attach="material"
                distort={0.3} // Strength of distortion
                speed={0.8} // Speed of distortion
                roughness={0.2}
            />
        </Sphere>
    )
}

export default function Hero3D() {
    return (
        <div className="absolute inset-0 w-full h-full -z-10 opacity-40">
            <Canvas dpr={[1, 2]} performance={{ min: 0.5 }}>
                <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.3} enableDamping dampingFactor={0.05} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[2, 5, 2]} intensity={1} />
                <AnimatedSphere />
            </Canvas>
        </div>
    )
}
