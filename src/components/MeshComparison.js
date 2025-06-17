import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Grid } from '@react-three/drei';
import * as THREE from 'three';
import './MeshComparison.css';
import config from '../config';

// Component for a single mesh
const Mesh = ({ vertices, faces, normals, color, wireframe, position, scale, rotation }) => {
  const geometryRef = useRef(null);
  const meshRef = useRef();
  const [meshPosition, setMeshPosition] = useState(position);
  
  // Create geometry from the provided vertices and faces
  useEffect(() => {
    if (vertices && faces) {
      try {
        const geometry = new THREE.BufferGeometry();
        const verticesArray = new Float32Array(vertices.flat());
        geometry.setAttribute('position', new THREE.BufferAttribute(verticesArray, 3));
        
        const indicesArray = new Uint32Array(faces.flat());
        geometry.setIndex(new THREE.BufferAttribute(indicesArray, 1));
        
        if (normals) {
          const normalsArray = new Float32Array(normals.flat());
          geometry.setAttribute('normal', new THREE.BufferAttribute(normalsArray, 3));
        } else {
          geometry.computeVertexNormals();
        }
        
        // Compute the bounding box to position the mesh on the floor
        geometry.computeBoundingBox();
        
        // Store for reference
        geometryRef.current = geometry;
        
        // Calculate correct Y position to place the bottom of the mesh on the floor
        if (geometry.boundingBox) {
          const box = geometry.boundingBox;
          const height = box.max.y - box.min.y;
          const bottom = box.min.y;
          
          // Calculate offset to place bottom of mesh at y=0
          const yOffset = -bottom;
          
          // Center on z-axis
          const zSize = box.max.z - box.min.z;
          const zCenter = box.min.z + (zSize / 2);
          const zOffset = -zCenter;
          
          // Update mesh position to sit on the floor and center on z-axis
          setMeshPosition([position[0], position[1] + yOffset, position[2] + zOffset]);
        }
      } catch (error) {
        console.error("Error creating geometry:", error);
      }
    }
  }, [vertices, faces, normals, position]);
  
  if (!vertices || !faces || !geometryRef.current) {
    return null;
  }
  
  return (
    <group position={meshPosition} rotation={rotation} scale={scale}>
      {/* Solid mesh */}
      <mesh 
        ref={meshRef}
        geometry={geometryRef.current}
        castShadow
        receiveShadow
      >
        <meshBasicMaterial 
          color={color}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Wireframe overlay if enabled */}
      {wireframe && (
        <mesh
          geometry={geometryRef.current}
        >
          <meshBasicMaterial
            color="#222222"
            wireframe={true}
            transparent={true}
            opacity={0.15}
          />
        </mesh>
      )}
    </group>
  );
};

// Component for transparent shadow-receiving surface
const ShadowSurface = ({ size = 50 }) => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <shadowMaterial transparent opacity={0.2} />
    </mesh>
  );
};

// Camera controller with sync functionality
const SyncedCamera = ({ index, isSynced, onCameraChange, position = [5, 3, 5], target }) => {
  const controlsRef = useRef();
  const updateInProgressRef = useRef(false);
  
  // Apply camera position and target from props
  useEffect(() => {
    if (!controlsRef.current || updateInProgressRef.current) return;
    
    const controls = controlsRef.current;
    
    if (target && isSynced) {
      controls.target.copy(target);
    }
  }, [target, isSynced]);
  
  // Set up camera sync between multiple views
  useEffect(() => {
    if (!controlsRef.current) return;
    
    const controls = controlsRef.current;
    
    // Function to update other cameras when this one changes
    const handleControlChange = () => {
      if (isSynced && onCameraChange && !updateInProgressRef.current) {
        updateInProgressRef.current = true;
        onCameraChange(index, {
          position: controls.object.position.clone(),
          target: controls.target.clone()
        });
        // Reset flag after a short delay to prevent recursive updates
        setTimeout(() => {
          updateInProgressRef.current = false;
        }, 50);
      }
    };
    
    // Add event listener for camera control changes (guard against null/undefined)
    if (controls && typeof controls.addEventListener === 'function') {
      controls.addEventListener('change', handleControlChange);
    }
    
    return () => {
      // Safely remove event listener with comprehensive null checks
      // Store the controls reference at cleanup time to avoid accessing stale ref
      const cleanupControls = controlsRef.current;
      if (cleanupControls && 
          typeof cleanupControls.removeEventListener === 'function' && 
          !cleanupControls.disposed) {
        try {
          cleanupControls.removeEventListener('change', handleControlChange);
        } catch (error) {
          // Silently handle case where controls is disposed or invalid
          console.warn('Could not remove event listener from controls:', error);
        }
      }
    };
  }, [index, isSynced, onCameraChange]);
  
  return (
    <>
      <PerspectiveCamera 
        makeDefault 
        fov={40} 
        near={0.1} 
        far={1000}
        position={position}
      />
      <OrbitControls 
        ref={controlsRef}
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        enableDamping={true}
        dampingFactor={0.1}
        minDistance={1}
        maxDistance={100}
      />
    </>
  );
};

const MeshComparison = ({ fileIds }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meshData, setMeshData] = useState(null);
  
  // UI state
  const [showWireframe, setShowWireframe] = useState(true);
  const [syncCameras, setSyncCameras] = useState(true);
  const [layout, setLayout] = useState('grid'); // 'grid' or 'stack'
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Single consistent color for all meshes
  const MESH_COLOR = "#0057B8";
  
  // For legend labels only - these don't affect the actual mesh colors
  const LEGEND_COLORS = [
    "#8ECAE6", // Light blue
    "#FFB4A2", // Light pink
    "#A8DADC", // Light teal
    "#B8F2E6", // Mint
    "#FAEDCB", // Light yellow
    "#C9E4DE", // Sage
    "#E6CCB2", // Light tan
    "#DBE7E4"  // Light gray-green
  ];
  
  // Light intensity control
  const [lightIntensity, setLightIntensity] = useState(1.0);
  
  // Camera state for syncing
  const [cameraStates, setCameraStates] = useState([]);
  const prevCameraUpdateTimeRef = useRef(0);
  
  // Handle camera change in any view
  const handleCameraChange = (changedIndex, newState) => {
    if (!syncCameras) return;
    
    // Add throttling to prevent flickering - limit updates to 30ms intervals
    const now = Date.now();
    if (now - prevCameraUpdateTimeRef.current < 30) {
      return;
    }
    prevCameraUpdateTimeRef.current = now;
    
    setCameraStates(prevStates => {
      const newStates = [...prevStates];
      
      // Update all camera states to match the changed camera
      for (let i = 0; i < newStates.length; i++) {
        if (i !== changedIndex) {
          newStates[i] = { ...newState };
        }
      }
      
      return newStates;
    });
  };
  
  // Fetch mesh data for comparison
  useEffect(() => {
    if (!fileIds || fileIds.length === 0) return;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch mesh data for all selected files
        const response = await axios.get(`${config.API_URL}/compare/mesh?file_ids=${fileIds.join(',')}`);
        setMeshData(response.data);
        
        // Initialize camera states for each file
        const initialCameraStates = fileIds.map(() => ({
          position: new THREE.Vector3(5, 3, 5),
          target: new THREE.Vector3(0, 0, 0)
        }));
        setCameraStates(initialCameraStates);
      } catch (err) {
        console.error('Error fetching mesh data:', err);
        setError('Failed to load mesh data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [fileIds]);
  
  // Calculate mesh layout settings
  const calculateGridSettings = () => {
    if (!fileIds || fileIds.length === 0) return {};
    
    const count = fileIds.length;
    let rows, cols;
    
    if (count <= 2) {
      rows = 1;
      cols = count;
    } else if (count <= 4) {
      rows = 2;
      cols = 2;
    } else if (count <= 6) {
      rows = 2;
      cols = 3;
    } else if (count <= 9) {
      rows = 3;
      cols = 3;
    } else {
      rows = 3;
      cols = 4;
    }
    
    return { rows, cols };
  };
  
  // Calculate position for each mesh in grid layout
  const getMeshPosition = (index) => {
    if (layout === 'stack') {
      // All meshes are centered in stack layout
      return [0, 0, 0];
    }
    
    // Grid layout - calculate position based on index
    const { rows, cols } = calculateGridSettings();
    const spacing = 4; // Space between meshes
    
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    const x = (col - (cols - 1) / 2) * spacing;
    const z = (row - (rows - 1) / 2) * spacing;
    
    return [x, 0, z];
  };
  
  // Render mesh grid/stack
  const renderMeshes = () => {
    if (!meshData || !meshData.results) return null;
    
    const productMeshes = [];
    
    // Create mesh components for each product
    Object.entries(meshData.results).forEach(([fileId, fileData], index) => {
      if (fileData.error || !fileData.has_mesh) return;
      
      const { mesh_data } = fileData;
      const position = getMeshPosition(index);
      
      // Only show active mesh in stack layout if not active
      if (layout === 'stack' && index !== activeIndex) {
        return;
      }
      
      productMeshes.push(
        <Mesh
          key={fileId}
          vertices={mesh_data.vertices}
          faces={mesh_data.faces}
          normals={mesh_data.normals}
          color={MESH_COLOR}
          wireframe={showWireframe}
          position={position}
          scale={[1, 1, 1]}
          rotation={[0, 0, 0]}
        />
      );
    });
    
    return productMeshes;
  };
  
  // Render product selector tabs for stack layout
  const renderProductTabs = () => {
    if (!meshData || !meshData.results || layout !== 'stack') return null;
    
    return (
      <div className="product-tabs">
        {Object.entries(meshData.results).map(([fileId, fileData], index) => (
          <button
            key={fileId}
            className={`product-tab ${index === activeIndex ? 'active' : ''}`}
            style={{ 
              borderBottom: `3px solid ${LEGEND_COLORS[index % LEGEND_COLORS.length]}`,
              backgroundColor: index === activeIndex ? `${LEGEND_COLORS[index % LEGEND_COLORS.length]}20` : ''
            }}
            onClick={() => setActiveIndex(index)}
          >
            {fileData.filename}
          </button>
        ))}
      </div>
    );
  };
  
  // Render grid of camera views for separate products
  const renderMeshGrid = () => {
    if (!meshData || !meshData.results) return null;
    
    const { rows, cols } = calculateGridSettings();
    
    return (
      <div 
        className="mesh-grid"
        style={{ 
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`
        }}
      >
        {Object.entries(meshData.results).map(([fileId, fileData], index) => (
          <div key={fileId} className="mesh-view">
            <div className="mesh-view-header" style={{ backgroundColor: `${LEGEND_COLORS[index % LEGEND_COLORS.length]}30` }}>
              <span className="view-title">{fileData.filename}</span>
              {fileData.error && <span className="error-badge">Error</span>}
            </div>
            
            <div className="mesh-canvas-container">
              {fileData.error || !fileData.has_mesh ? (
                <div className="mesh-error">
                  <p>{fileData.message || 'No mesh data available'}</p>
                </div>
              ) : (
                <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
                  <color attach="background" args={["#f8f9fb"]} />
                  
                  {/* Updated lighting configuration with extremely bright ambient light */}
                  <ambientLight intensity={3.0} />
                  <hemisphereLight intensity={2.0} color="#ffffff" groundColor="#555555" />
                  
                  {/* Main directional light with shadow */}
                  <directionalLight 
                    intensity={lightIntensity * 3.0}
                    position={[5, 10, 5]} 
                    castShadow
                    shadow-mapSize-width={1024}
                    shadow-mapSize-height={1024}
                    shadow-camera-far={50}
                    shadow-camera-left={-10}
                    shadow-camera-right={10}
                    shadow-camera-top={10}
                    shadow-camera-bottom={-10}
                  />
                  
                  {/* Additional light from below to eliminate shadows */}
                  <directionalLight 
                    intensity={lightIntensity * 2.0}
                    position={[0, -10, 0]} 
                  />
                  
                  {/* Secondary fill light */}
                  <directionalLight 
                    intensity={lightIntensity * 2.0}
                    position={[-5, 3, -5]} 
                  />
                  
                  {/* Add an additional light from front */}
                  <directionalLight 
                    intensity={lightIntensity * 2.0}
                    position={[0, 2, 10]} 
                  />
                  
                  {/* Add the shadow-receiving surface */}
                  <ShadowSurface />
                  
                  <Mesh
                    vertices={fileData.mesh_data.vertices}
                    faces={fileData.mesh_data.faces}
                    normals={fileData.mesh_data.normals}
                    color={MESH_COLOR}
                    wireframe={showWireframe}
                    position={[0, 0, 0]}
                    scale={[1, 1, 1]}
                    rotation={[0, 0, 0]}
                  />
                  
                  {/* Updated Grid from MeshVisualizer */}
                  <Grid 
                    position={[0, -0.01, 0]} 
                    args={[20, 20]} 
                    cellSize={1} 
                    cellThickness={0.5} 
                    cellColor="#6f7284" 
                    sectionSize={5}
                    sectionThickness={1}
                    sectionColor="#9d4b4b"
                    fadeDistance={30}
                    fadeStrength={1}
                  />
                  
                  <SyncedCamera 
                    index={index}
                    isSynced={syncCameras}
                    position={cameraStates[index]?.position || [5, 3, 5]}
                    target={cameraStates[index]?.target || new THREE.Vector3(0, 0, 0)}
                    onCameraChange={handleCameraChange}
                  />
                  
                  <Environment preset="sunset" background={false} />
                </Canvas>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="mesh-comparison-loading">
        <div className="spinner"></div>
        <p>Loading mesh data...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="mesh-comparison-error">
        <div className="error-icon">❌</div>
        <p>{error}</p>
        <button className="retry-button" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }
  
  if (fileIds.length === 0) {
    return (
      <div className="mesh-comparison-empty">
        <p>Select files to compare using the file manager.</p>
      </div>
    );
  }
  
  return (
    <div className="mesh-comparison">
      <h2>3D Mesh Comparison</h2>
      
      <div className="controls">
        <div className="layout-controls">
          <label>Layout:</label>
          <div className="toggle-buttons">
            <button 
              className={`toggle-button ${layout === 'grid' ? 'active' : ''}`}
              onClick={() => setLayout('grid')}
            >
              Grid View
            </button>
            <button 
              className={`toggle-button ${layout === 'stack' ? 'active' : ''}`}
              onClick={() => setLayout('stack')}
            >
              Stack View
            </button>
          </div>
        </div>
        
        <div className="view-options">
          <label className="option-toggle">
            <input 
              type="checkbox"
              checked={showWireframe}
              onChange={() => setShowWireframe(!showWireframe)}
            />
            Show Wireframe
          </label>
          
          <label className="option-toggle">
            <input 
              type="checkbox"
              checked={syncCameras}
              onChange={() => setSyncCameras(!syncCameras)}
            />
            Sync Camera Movement
          </label>
          
          {/* <div className="light-intensity-control">
            <label>Light Intensity</label>
            <input 
              type="range" 
              min="0.1" 
              max="2" 
              step="0.1" 
              value={lightIntensity}
              onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
            />
          </div> */}
        </div>
      </div>
      
      {/* Product tabs for stack layout */}
      {renderProductTabs()}
      
      {/* Main view container */}
      <div className="mesh-container">
        {layout === 'stack' ? (
          <div className="single-mesh-view">
            <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
              <color attach="background" args={["#f8f9fb"]} />
              
              {/* Updated lighting configuration with extremely bright ambient light */}
              <ambientLight intensity={3.0} />
              <hemisphereLight intensity={2.0} color="#ffffff" groundColor="#555555" />
              
              {/* Main directional light with shadow */}
              <directionalLight 
                intensity={lightIntensity * 3.0}
                position={[5, 10, 5]} 
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
                shadow-camera-far={50}
                shadow-camera-left={-10}
                shadow-camera-right={10}
                shadow-camera-top={10}
                shadow-camera-bottom={-10}
              />
              
              {/* Additional light from below to eliminate shadows */}
              <directionalLight 
                intensity={lightIntensity * 2.0}
                position={[0, -10, 0]} 
              />
              
              {/* Secondary fill light */}
              <directionalLight 
                intensity={lightIntensity * 2.0}
                position={[-5, 3, -5]} 
              />
              
              {/* Add an additional light from front */}
              <directionalLight 
                intensity={lightIntensity * 2.0}
                position={[0, 2, 10]} 
              />
              
              {renderMeshes()}
              
              {/* Add the shadow-receiving surface */}
              <ShadowSurface />
              
              {/* Updated Grid from MeshVisualizer */}
              <Grid 
                position={[0, -0.01, 0]} 
                args={[20, 20]} 
                cellSize={1} 
                cellThickness={0.5} 
                cellColor="#6f7284" 
                sectionSize={5}
                sectionThickness={1}
                sectionColor="#9d4b4b"
                fadeDistance={30}
                fadeStrength={1}
              />
              
              <SyncedCamera 
                index={0}
                isSynced={syncCameras}
                position={cameraStates[0]?.position || [5, 3, 5]}
                target={cameraStates[0]?.target || new THREE.Vector3(0, 0, 0)}
                onCameraChange={handleCameraChange}
              />
              
              <Environment preset="sunset" background={false} />
            </Canvas>
          </div>
        ) : (
          renderMeshGrid()
        )}
      </div>
      
      <div className="legend">
        <h3>Models</h3>
        <div className="legend-items">
          {meshData && meshData.results && Object.entries(meshData.results).map(([fileId, fileData], index) => (
            <div key={fileId} className="legend-item">
              <span 
                className="color-box" 
                style={{ backgroundColor: LEGEND_COLORS[index % LEGEND_COLORS.length] }}
              ></span>
              <span className="legend-label">{fileData.filename}</span>
              {!fileData.has_mesh && (
                <span className="no-mesh-badge">No mesh</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MeshComparison; 