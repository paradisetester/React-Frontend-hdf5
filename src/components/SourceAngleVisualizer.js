import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';
import './SourceAngleVisualizer.css';

// Convert spherical coordinates (azimuth, elevation) to cartesian (x, y, z)
const sphericalToCartesian = (azimuthDeg, elevationDeg, radius = 5) => {
  // Log the original angles for debugging
  console.log(`Converting source angle: azimuth ${azimuthDeg}°, elevation ${elevationDeg}°`);
  
  // Handle special cases more comprehensively
  // In acoustics, we may have sources at the poles that need special handling
  if ((Math.abs(elevationDeg) === 90) || (azimuthDeg === 0 && elevationDeg === 90)) {
    console.log(`Special case: Source at poles (elevation: ${elevationDeg}°)`);
    
    // For +90° elevation (top pole), place directly above
    if (elevationDeg === 90) {
      return [0, radius, 0]; 
    }
    
    // For -90° elevation (bottom pole), place directly below
    if (elevationDeg === -90) {
      return [0, -radius, 0];
    }
  }
  
  // Convert degrees to radians
  // In standard spherical coordinates, theta is measured from zenith (0° at top, 90° at horizon)
  // and phi is azimuthal angle in the x-z plane (0° along +x axis)
  const azimuthRad = (azimuthDeg * Math.PI) / 180;
  
  // Convert elevation to zenith angle (theta)
  // Elevation of 0° means horizontal (90° in zenith angle)
  // Elevation of 90° means directly above (0° in zenith angle)
  const zenithRad = ((90 - elevationDeg) * Math.PI) / 180;
  
  // Standard spherical coordinates to Cartesian conversion
  // x = r * sin(theta) * cos(phi)
  // y = r * cos(theta)
  // z = r * sin(theta) * sin(phi)
  const x = radius * Math.sin(zenithRad) * Math.cos(azimuthRad);
  const y = radius * Math.cos(zenithRad);
  const z = radius * Math.sin(zenithRad) * Math.sin(azimuthRad);
  
  console.log(`Computed 3D position: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`);
  
  return [x, y, z];
};

// Pyramid component representing the diffusor
const Pyramid = () => {
  const pyramidRef = useRef();
  
  useFrame(() => {
    if (pyramidRef.current) {
      // Very subtle rotation for visual interest
      pyramidRef.current.rotation.y += 0.001;
    }
  });

  return (
    <mesh ref={pyramidRef} position={[0, 0, 0]}>
      <cylinderGeometry args={[0, 2, 2, 4, 1]} />
      <meshStandardMaterial color="#8a9ba8" />
    </mesh>
  );
};

// Source component representing each source angle
const Source = ({ angle, index, isSelected, isRandomMode, onClick }) => {
  const [x, y, z] = sphericalToCartesian(angle[0], angle[1]);
  const sourceRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
  }, [hovered]);
  
  useFrame(() => {
    if (sourceRef.current) {
      // Determine if this source should pulse (in selected or random mode)
      const shouldPulse = isSelected || isRandomMode;
      
      if (shouldPulse) {
        // Use different phases for each source in random mode to create a wave effect
        const phase = isRandomMode ? index * 0.2 : 0;
        const pulseAmount = 0.1;
        sourceRef.current.scale.x = 1 + Math.sin(Date.now() * 0.005 + phase) * pulseAmount;
        sourceRef.current.scale.y = 1 + Math.sin(Date.now() * 0.005 + phase) * pulseAmount;
        sourceRef.current.scale.z = 1 + Math.sin(Date.now() * 0.005 + phase) * pulseAmount;
      } else {
        sourceRef.current.scale.set(1, 1, 1);
      }
    }
  });

  // Different colors based on state
  let sphereColor, emissiveColor, emissiveIntensity;
  
  if (isRandomMode) {
    // Purple color scheme for random mode
    sphereColor = "#9b59b6";
    emissiveColor = "#8e44ad";
    emissiveIntensity = 0.4;
  } else if (isSelected) {
    // Orange color scheme for selected source
    sphereColor = "#ff9500";
    emissiveColor = "#ff5500";
    emissiveIntensity = 0.5;
  } else if (hovered) {
    // Yellow color scheme for hover
    sphereColor = "#ffcc00";
    emissiveColor = "#ffa500";
    emissiveIntensity = 0.3;
  } else {
    // Blue color scheme for default
    sphereColor = "#3498db";
    emissiveColor = "#000000";
    emissiveIntensity = 0;
  }

  return (
    <>
      <Sphere
        ref={sourceRef}
        args={[0.3, 16, 16]} // Slightly larger radius for easier clicking
        position={[x, y, z]} // Fixed: No longer swapping coordinates
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial 
          color={sphereColor} 
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
        />
      </Sphere>
      
      {/* HTML label with pointer-events set to none */}
      <Html 
        position={[x, y + 0.6, z]} // Updated position
        style={{ 
          pointerEvents: 'none', // This makes mouse events pass through the label
          userSelect: 'none'     // Prevents text selection
        }}
      >
        <div className={`source-label ${isSelected ? 'selected' : ''} ${isRandomMode ? 'random-mode' : ''}`}>
          {index + 1}
        </div>
      </Html>
    </>
  );
};

// Main scene component
const Scene = ({ sourceAngles, selectedIndex, isRandomMode, onSelectSource }) => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      
      <Pyramid />
      
      {sourceAngles.map((angle, index) => (
        <Source 
          key={index}
          angle={angle} 
          index={index}
          isSelected={index === selectedIndex}
          isRandomMode={isRandomMode}
          onClick={() => onSelectSource(index)}
        />
      ))}
      
      {/* Add a simple grid for reference */}
      <gridHelper args={[30, 30, '#666666', '#222222']} />
      
      {/* Enable orbit controls with increased zoom range */}
      <OrbitControls 
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        minDistance={3}       // Allow zooming closer
        maxDistance={30}      // Allow zooming much further out
        maxPolarAngle={Math.PI}  // Allow full rotation
      />
    </>
  );
};

// Main visualization component
const SourceAngleVisualizer = ({ sourceAngles, selectedIndex, isRandomMode, onSelectSource }) => {
  return (
    <div className="source-visualizer-container">
      <Canvas 
        camera={{ position: [0, 15, 15], fov: 45 }}  // Adjusted camera position for better view
        shadows
      >
        <Scene 
          sourceAngles={sourceAngles} 
          selectedIndex={selectedIndex}
          isRandomMode={isRandomMode}
          onSelectSource={onSelectSource}
        />
      </Canvas>
    </div>
  );
};

export default SourceAngleVisualizer; 