import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import SourceAngleVisualizer from './SourceAngleVisualizer';
import './PolarComparison3D.css';
import config from '../config';

// Component to render the 3D polar response mesh
const PolarMesh = ({ coordinates, connectivity, pressure, pressureLim }) => {
  const meshRef = useRef();
  const geometryRef = useRef(null);
  
  // Create geometry using Three.js methods
  useEffect(() => {
    if (!coordinates || !connectivity || !pressure) {
      console.log('Missing required data for mesh creation');
      return;
    }

    try {
      // Create a new buffer geometry
      const geometry = new THREE.BufferGeometry();
      
      // Find maximum pressure value for normalization
      const maxPressure = Math.max(...pressure);
      
      // Convert coordinates to spherical and use pressure as radius
      const vertices = new Float32Array(coordinates.length * 3);
      coordinates.forEach((coord, i) => {
        // Convert to spherical coordinates
        const x = coord[0];
        const y = coord[1];
        const z = coord[2];
        
        // Calculate theta (azimuthal angle in x-y plane from x-axis) and phi (polar angle from z-axis)
        const r = Math.sqrt(x * x + y * y + z * z);
        const theta = Math.atan2(y, x); // azimuthal angle in x-y plane
        const phi = Math.acos(z / (r || 1)); // polar angle from z-axis
        
        // Only use the upper hemisphere (phi from 0 to pi/2)
        const upperPhi = Math.min(phi, Math.PI / 2);
        
        // Normalize pressure relative to maximum value and pressureLim
        const pressureRelativeToMax = pressure[i] - maxPressure;
        const normalizedPressure = Math.max(pressureRelativeToMax + pressureLim, 0) / pressureLim;
        const radius = normalizedPressure * 5; // Scale factor of 5 for visualization
        
        // Convert back to Cartesian with new radius, ensuring z is positive
        vertices[i * 3] = radius * Math.sin(upperPhi) * Math.cos(theta);     // x
        vertices[i * 3 + 1] = radius * Math.sin(upperPhi) * Math.sin(theta); // y
        vertices[i * 3 + 2] = radius * Math.cos(upperPhi);                   // z (always positive)
      });
      
      // Add position attribute
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      
      // Add index for faces - ensure indices are 0-based and check for gaps
      const isOneBased = Math.min(...connectivity.flat()) === 1;
      const vertexOffset = isOneBased ? 1 : 0;
      
      // Create index array
      const indices = [];
      connectivity.forEach((face) => {
        // Convert to 0-based indices if needed
        const v1 = face[0] - vertexOffset;
        const v2 = face[1] - vertexOffset;
        const v3 = face[2] - vertexOffset;
        
        // Ensure vertices exist and indices are valid
        if (v1 >= 0 && v2 >= 0 && v3 >= 0 && 
            v1 < coordinates.length && 
            v2 < coordinates.length && 
            v3 < coordinates.length) {
          // Add face with correct winding order
          indices.push(v1, v2, v3);
        }
      });
      
      // Set indices
      geometry.setIndex(indices);
      
      // Add pressure values as colors using the same normalization
      const colors = new Float32Array(coordinates.length * 3);
      pressure.forEach((p, i) => {
        const pressureRelativeToMax = p - maxPressure;
        const normalizedPressure = Math.max(pressureRelativeToMax + pressureLim, 0) / pressureLim;
        
        let r, g, b;
        const val = normalizedPressure;
        
        if (val <= 0.125) {
          r = 0;
          g = 0;
          b = 0.5 + 4 * val;
        } else if (val <= 0.375) {
          r = 0;
          g = 4 * (val - 0.125);
          b = 1;
        } else if (val <= 0.625) {
          r = 4 * (val - 0.375);
          g = 1;
          b = 1 - 4 * (val - 0.375);
        } else if (val <= 0.875) {
          r = 1;
          g = 1 - 4 * (val - 0.625);
          b = 0;
        } else {
          r = 1 - 4 * (val - 0.875);
          g = 0;
          b = 0;
        }
        
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      });
      
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      // Compute normals for smooth shading
      geometry.computeVertexNormals();
      
      // If we have an existing geometry, dispose of it
      if (geometryRef.current) {
        geometryRef.current.dispose();
      }

      // Store the new geometry
      geometryRef.current = geometry;
      
      // Force mesh update
      if (meshRef.current) {
        meshRef.current.geometry = geometry;
      }
      
    } catch (error) {
      console.error("Error creating geometry:", error);
    }
  }, [coordinates, connectivity, pressure, pressureLim]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (geometryRef.current) {
        geometryRef.current.dispose();
      }
    };
  }, []);

  if (!geometryRef.current) {
    return null;
  }
  
  return (
    <mesh ref={meshRef} geometry={geometryRef.current}>
      <meshPhongMaterial 
        vertexColors={true}
        side={THREE.DoubleSide}
        shininess={50}
        flatShading={false}
      />
    </mesh>
  );
};

// Spherical grid to show angle references
const SphericalGrid = ({ radius = 5, segments = 72 }) => {
  const lineRef = useRef();

  useEffect(() => {
    const points = [];
    const colors = [];
    const color = new THREE.Color('#444444');
    const colorLight = new THREE.Color('#CCCCCC');

    // Create radial lines every 10 degrees in XY plane
    for (let angle = 0; angle <= 350; angle += 10) {
      const theta = angle * Math.PI / 180;
      points.push(0, 0, 0);
      points.push(radius * Math.cos(theta), radius * Math.sin(theta), 0);
      
      if (angle % 30 === 0) {
        colors.push(color.r, color.g, color.b);
        colors.push(color.r, color.g, color.b);
      } else {
        colors.push(colorLight.r, colorLight.g, colorLight.b);
        colors.push(colorLight.r, colorLight.g, colorLight.b);
      }
    }

    // Create concentric circles in XY plane
    for (let r = radius * 0.2; r <= radius; r += radius * 0.2) {
      for (let i = 0; i <= segments; i++) {
        const theta = (i * 360) / segments * Math.PI / 180;
        const x = r * Math.cos(theta);
        const y = r * Math.sin(theta);
        points.push(x, y, 0);
        colors.push(colorLight.r, colorLight.g, colorLight.b);
      }
    }

    // Create quarter circles in XZ plane at different radii
    for (let r = radius * 0.2; r <= radius; r += radius * 0.2) {
      for (let i = 0; i <= segments/4; i++) {
        const theta = (i * 90) / (segments/4) * Math.PI / 180;
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        points.push(x, 0, z);
        colors.push(colorLight.r, colorLight.g, colorLight.b);
      }
    }

    // Create radial lines in XZ plane every 10 degrees (quarter circle)
    for (let angle = 0; angle <= 90; angle += 10) {
      const theta = angle * Math.PI / 180;
      points.push(0, 0, 0);
      points.push(radius * Math.cos(theta), 0, radius * Math.sin(theta));
      
      if (angle % 30 === 0) {
        colors.push(color.r, color.g, color.b);
        colors.push(color.r, color.g, color.b);
      } else {
        colors.push(colorLight.r, colorLight.g, colorLight.b);
        colors.push(colorLight.r, colorLight.g, colorLight.b);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    lineRef.current.geometry = geometry;
  }, [radius, segments]);

  return (
    <>
      <line ref={lineRef}>
        <bufferGeometry />
        <lineBasicMaterial vertexColors attach="material" />
      </line>
      {/* Angle labels every 30 degrees, excluding 360 to avoid overlap */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = i * 30;
        const theta = angle * Math.PI / 180;
        const x = (radius + 0.3) * Math.cos(theta);
        const y = (radius + 0.3) * Math.sin(theta);
        return (
          <group key={angle} position={[x, y, 0]}>
            <Html center>
              <div style={{ 
                color: '#444444', 
                fontSize: '12px',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                transform: `rotate(${-angle}deg)`
              }}>
                {angle}°
              </div>
            </Html>
          </group>
        );
      })}
      {/* Add elevation angle labels in XZ plane */}
      {[0, 30, 60, 90].map((angle) => {
        const theta = angle * Math.PI / 180;
        const x = (radius + 0.3) * Math.cos(theta);
        const z = (radius + 0.3) * Math.sin(theta);
        return (
          <group key={`elevation-${angle}`} position={[x, 0, z]}>
            <Html center>
              <div style={{ 
                color: '#444444', 
                fontSize: '12px',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                pointerEvents: 'none'
              }}>
                {angle}°
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
};

// Camera controller with sync functionality
const SyncedCamera = ({ index, isSynced, onCameraChange, position = [5, 3, 5], target }) => {
  const controlsRef = useRef();
  const cameraRef = useRef();
  const updateInProgressRef = useRef(false);
  
  // Apply camera position and target from props
  useEffect(() => {
    if (!controlsRef.current || !cameraRef.current || updateInProgressRef.current) return;
    
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    
    // Set default camera position
    if (!position.isVector3) {
      camera.position.set(position[0], position[1], position[2]);
    } else {
      camera.position.copy(position);
    }
    
    // Set target if in sync mode
    if (target && isSynced) {
      controls.target.copy(target);
    } else {
      // Default target at origin
      controls.target.set(0, 0, 0);
    }
    
    // Apply optimal camera settings
    controls.minDistance = 3;
    controls.maxDistance = 30;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    
    // Update controls
    controls.update();
  }, [target, isSynced, position]);
  
  // Adjust camera FOV based on container size
  useEffect(() => {
    if (!cameraRef.current) return;
    
    const handleResize = () => {
      const camera = cameraRef.current;
      if (!camera) return; // Additional null check
      
      // Get container aspect ratio
      const container = camera.el?.parentElement;
      if (container) {
        const { width, height } = container.getBoundingClientRect();
        const aspectRatio = width / height;
        
        // Adjust FOV based on aspect ratio to maintain consistent view
        camera.fov = aspectRatio < 1 ? 60 : 45; // Wider FOV for portrait orientation
        camera.updateProjectionMatrix();
      }
    };
    
    // Initial sizing
    const timeoutId = setTimeout(handleResize, 100);
    
    // Listen for resize events
    window.addEventListener('resize', handleResize);
    
    return () => {
      // Clean up timeout and event listener
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
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
  
  // Update controls on each frame for smoother animation
  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.update();
    }
  });
  
  return (
    <>
      <PerspectiveCamera 
        ref={cameraRef}
        makeDefault 
        fov={45} 
        near={0.1} 
        far={1000}
        position={position}
        up={[0, 0, 1]} // Ensure camera up vector matches scene
      />
      <OrbitControls 
        ref={controlsRef}
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        enableDamping={true}
        dampingFactor={0.1}
        minDistance={3}
        maxDistance={30}
      />
    </>
  );
};

// Main component
const PolarComparison3D = ({ fileIds }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [polarData, setPolarData] = useState(null);
  
  // UI state
  const [selectedFrequencyIndex, setSelectedFrequencyIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('diffusor'); // 'diffusor' or 'reflector'
  const [syncCameras, setSyncCameras] = useState(true);
  const [pressureLim, setPressureLim] = useState(30);
  const [layout, setLayout] = useState('grid'); // 'grid' or 'stack'
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Source selection state
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const [sourceAngles, setSourceAngles] = useState([]);
  const [frequencies, setFrequencies] = useState([]);
  
  // Camera state for syncing
  const [cameraStates, setCameraStates] = useState([]);
  const prevCameraUpdateTimeRef = useRef(0);
  
  // Colors for different products
  const PRODUCT_COLORS = [
    "#8ECAE6", // Light blue
    "#FFB4A2", // Light pink
    "#A8DADC", // Light teal
    "#B8F2E6", // Mint
    "#FAEDCB", // Light yellow
    "#C9E4DE", // Sage
    "#E6CCB2", // Light tan
    "#DBE7E4"  // Light gray-green
  ];
  
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
  
  // Initialize camera states when files change
  useEffect(() => {
    if (!fileIds || fileIds.length === 0) {
      setCameraStates([]);
      return;
    }
    
    // Only initialize camera states if we don't have the right number or if fileIds changed
    setCameraStates(prevStates => {
      if (prevStates.length !== fileIds.length) {
        return fileIds.map(() => ({
          position: new THREE.Vector3(10, 10, 10),
          target: new THREE.Vector3(0, 0, 0)
        }));
      }
      return prevStates; // Keep existing camera states
    });
  }, [fileIds]);

  // Fetch data for all files
  useEffect(() => {
    if (!fileIds || fileIds.length === 0) return;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch comparative data for all files
        const response = await axios.get(`${config.API_URL}/compare/polar3d?file_ids=${fileIds.join(',')}&source_index=${selectedSourceIndex}&freq_index=${selectedFrequencyIndex}&surface=${activeTab}`);
        
        setPolarData(response.data);
        
        // Set the frequency list if available
        if (response.data.common_frequencies) {
          setFrequencies(response.data.common_frequencies);
        }
        
        // Set source angles if available
        if (response.data.source_angles && response.data.source_angles.length > 0) {
          setSourceAngles(response.data.source_angles);
        }
        
      } catch (err) {
        console.error('Error fetching 3D polar comparison data:', err);
        setError('Failed to load 3D polar response data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [fileIds, selectedSourceIndex, selectedFrequencyIndex, activeTab]);
  
  // Calculate mesh grid settings
  const calculateGridSettings = () => {
    if (!fileIds || fileIds.length === 0) return { rows: 1, cols: 1 };
    
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
  
  // Helper to format source angle display
  const formatAngle = (angle) => {
    if (!angle) return '';
    return `${angle[0].toFixed(1)}° (az), ${angle[1].toFixed(1)}° (el)`;
  };
  
  // Render product selector tabs for stack layout
  const renderProductTabs = () => {
    if (!polarData || !polarData.results || layout !== 'stack') return null;
    
    return (
      <div className="product-tabs">
        {Object.entries(polarData.results).map(([fileId, fileData], index) => (
          <button
            key={fileId}
            className={`product-tab ${index === activeIndex ? 'active' : ''}`}
            style={{ 
              borderBottom: `3px solid ${PRODUCT_COLORS[index % PRODUCT_COLORS.length]}`,
              backgroundColor: index === activeIndex ? `${PRODUCT_COLORS[index % PRODUCT_COLORS.length]}20` : ''
            }}
            onClick={() => setActiveIndex(index)}
          >
            {fileData.filename}
          </button>
        ))}
      </div>
    );
  };
  
  // Render mesh grid view
  const renderMeshGrid = () => {
    if (!polarData || !polarData.results) return null;
    
    const { rows, cols } = calculateGridSettings();
    
    return (
      <div 
        className="polar-3d-grid"
        style={{ 
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`
        }}
      >
        {Object.entries(polarData.results).map(([fileId, fileData], index) => (
          <div key={fileId} className="polar-3d-view">
            <div className="polar-view-header" style={{ backgroundColor: `${PRODUCT_COLORS[index % PRODUCT_COLORS.length]}30` }}>
              <span className="view-title">{fileData.filename}</span>
              {fileData.error && <span className="error-badge">Error</span>}
            </div>
            
            <div className="polar-canvas-container">
              {fileData.error ? (
                <div className="polar-error">
                  <p>{fileData.message || 'No polar data available'}</p>
                </div>
              ) : (
                <Canvas
                  camera={{ position: [10, 10, 10], fov: 45 }}
                  dpr={[1, 2]} // Better resolution on high-DPI displays, limited to 2x for performance
                >
                  <color attach="background" args={["#f8f9fb"]} />
                  
                  <ambientLight intensity={0.6} />
                  <directionalLight position={[10, 10, 10]} intensity={0.8} />
                  <directionalLight position={[-10, -10, 10]} intensity={0.4} />
                  <directionalLight position={[0, 0, 10]} intensity={0.6} />
                  
                  {/* Spherical grid */}
                  <SphericalGrid radius={6} segments={72} />
                  
                  {/* Polar response mesh */}
                  {!fileData.error && fileData.pressure && fileData.coordinates && fileData.connectivity && (
                    <PolarMesh 
                      coordinates={fileData.coordinates}
                      connectivity={fileData.connectivity}
                      pressure={fileData.pressure}
                      pressureLim={pressureLim}
                    />
                  )}
                  
                  <SyncedCamera 
                    index={index}
                    isSynced={syncCameras}
                    position={cameraStates[index]?.position || [10, 10, 10]}
                    target={cameraStates[index]?.target || new THREE.Vector3(0, 0, 0)}
                    onCameraChange={handleCameraChange}
                  />
                  
                  <Environment preset="city" background={false} />
                </Canvas>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  // Render stack view (single mesh view with tabs)
  const renderStackView = () => {
    if (!polarData || !polarData.results) return null;
    
    const fileEntries = Object.entries(polarData.results);
    if (fileEntries.length === 0) return null;
    
    const activeFileId = fileEntries[activeIndex]?.[0];
    const activeFileData = fileEntries[activeIndex]?.[1];
    
    if (!activeFileData) return null;
    
    return (
      <div className="single-polar-view">
        {activeFileData.error ? (
          <div className="polar-error">
            <p>{activeFileData.message || 'No polar data available'}</p>
          </div>
        ) : (
          <Canvas
            camera={{ position: [10, 10, 10], fov: 45 }}
            dpr={[1, 2]}
          >
            <color attach="background" args={["#f8f9fb"]} />
            
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 10, 10]} intensity={0.8} />
            <directionalLight position={[-10, -10, 10]} intensity={0.4} />
            <directionalLight position={[0, 0, 10]} intensity={0.6} />
            
            {/* Spherical grid */}
            <SphericalGrid radius={6} segments={72} />
            
            {/* Polar response mesh */}
            {!activeFileData.error && activeFileData.pressure && activeFileData.coordinates && activeFileData.connectivity && (
              <PolarMesh 
                coordinates={activeFileData.coordinates}
                connectivity={activeFileData.connectivity}
                pressure={activeFileData.pressure}
                pressureLim={pressureLim}
              />
            )}
            
            <SyncedCamera 
              index={0}
              isSynced={syncCameras}
              position={cameraStates[0]?.position || [10, 10, 10]}
              target={cameraStates[0]?.target || new THREE.Vector3(0, 0, 0)}
              onCameraChange={handleCameraChange}
            />
            
            <Environment preset="city" background={false} />
          </Canvas>
        )}
      </div>
    );
  };
  
  if (loading && !polarData) {
    return (
      <div className="polar-comparison-3d-loading">
        <div className="spinner"></div>
        <p>Loading 3D polar response data...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="polar-comparison-3d-error">
        <div className="error-icon">❌</div>
        <p>{error}</p>
        <button className="retry-button" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }
  
  if (fileIds.length === 0) {
    return (
      <div className="polar-comparison-3d-empty">
        <p>Select files to compare using the file manager.</p>
      </div>
    );
  }
  
  return (
    <div className="polar-comparison-3d">
      {/* <h2>3D Polar Response Comparison</h2> */}
      
      <div className="controls">
        <div className="left-controls">
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
          
          <div className="tab-controls">
            <button 
              className={`tab-button ${activeTab === 'diffusor' ? 'active' : ''}`}
              onClick={() => setActiveTab('diffusor')}
            >
              Diffusor
            </button>
            <button 
              className={`tab-button ${activeTab === 'reflector' ? 'active' : ''}`}
              onClick={() => setActiveTab('reflector')}
            >
              Reflector
            </button>
          </div>
        </div>
        
        <div className="view-options">
          <label className="option-toggle">
            <input 
              type="checkbox"
              checked={syncCameras}
              onChange={() => setSyncCameras(!syncCameras)}
            />
            Sync Camera Movement
          </label>
          
          <div className="pressure-limit-control">
            <label>Pressure Limit (dB):</label>
            <input 
              type="number" 
              value={pressureLim}
              onChange={(e) => setPressureLim(Math.max(1, parseInt(e.target.value)))}
              min="1"
              step="1"
            />
          </div>
        </div>
      </div>
      
      {/* Source selection component */}
      {sourceAngles.length > 0 && (
        <div className="source-selector-container">
          <div className="source-selector-label">Source Angle:</div>
          <select 
            className="source-selector"
            value={selectedSourceIndex}
            onChange={(e) => setSelectedSourceIndex(parseInt(e.target.value))}
          >
            {sourceAngles.map((angle, index) => (
              <option key={index} value={index}>
                Source {index + 1}: {formatAngle(angle)}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Product tabs for stack layout */}
      {renderProductTabs()}
      
      {/* Main view container */}
      <div className="polar-container">
        {layout === 'stack' ? renderStackView() : renderMeshGrid()}
        
        {loading && polarData && (
          <div className="loading-overlay">
            <div className="mini-spinner"></div>
          </div>
        )}
      </div>
      
      {/* Frequency slider */}
      {frequencies.length > 0 && (
        <div className="frequency-slider-container">
          <div className="slider-info">
            <span className="slider-label">Frequency</span>
            <span className="frequency-value">{Math.round(frequencies[selectedFrequencyIndex])} Hz</span>
          </div>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max={frequencies.length - 1}
              value={selectedFrequencyIndex}
              onChange={(e) => setSelectedFrequencyIndex(parseInt(e.target.value))}
              className="frequency-slider"
            />
          </div>
          <div className="slider-range-labels">
            <span>{Math.round(frequencies[0])} Hz</span>
            <span>{Math.round(frequencies[frequencies.length - 1])} Hz</span>
          </div>
        </div>
      )}
      
      <div className="legend">
        <h3>Models</h3>
        <div className="legend-items">
          {polarData && polarData.results && Object.entries(polarData.results).map(([fileId, fileData], index) => (
            <div key={fileId} className="legend-item">
              <span 
                className="color-box" 
                style={{ backgroundColor: PRODUCT_COLORS[index % PRODUCT_COLORS.length] }}
              ></span>
              <span className="legend-label">{fileData.filename}</span>
              {fileData.error && (
                <span className="no-data-badge">No data</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PolarComparison3D; 