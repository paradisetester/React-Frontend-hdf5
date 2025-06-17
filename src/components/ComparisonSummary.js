import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './ComparisonSummary.css';
import config from '../config';

// Simplified Mesh component for thumbnails
const ThumbnailMesh = ({ vertices, faces, normals, color = "#2d8df3" }) => {
  const meshRef = React.useRef();
  const [geometry, setGeometry] = React.useState(null);
  
  React.useEffect(() => {
    if (!vertices || !faces) {
      console.log('Missing vertices or faces for thumbnail mesh');
      return;
    }

    try {
      // Create geometry
      const newGeometry = new THREE.BufferGeometry();
      
      // Flatten and convert vertices
      const verticesArray = new Float32Array(vertices.flat());
      newGeometry.setAttribute('position', new THREE.BufferAttribute(verticesArray, 3));
      
      // Convert faces to indices
      const indicesArray = new Uint32Array(faces.flat());
      newGeometry.setIndex(new THREE.BufferAttribute(indicesArray, 1));
      
      // Handle normals
      if (normals && normals.length > 0) {
        const normalsArray = new Float32Array(normals.flat());
        newGeometry.setAttribute('normal', new THREE.BufferAttribute(normalsArray, 3));
      } else {
        newGeometry.computeVertexNormals();
      }
      
      // Store geometry
      setGeometry(newGeometry);
      
      console.log(`Thumbnail geometry created with ${vertices.length} vertices and ${faces.length} faces`);
      
    } catch (error) {
      console.error("Error creating thumbnail geometry:", error);
      setGeometry(null);
    }
    
    // Cleanup previous geometry
    return () => {
      if (geometry) {
        try {
          geometry.dispose();
        } catch (error) {
          console.warn('Could not dispose previous geometry:', error);
        }
      }
    };
  }, [vertices, faces, normals]);
  
  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (geometry) {
        try {
          geometry.dispose();
        } catch (error) {
          console.warn('Could not dispose thumbnail geometry on unmount:', error);
        }
      }
    };
  }, [geometry]);
  
  if (!geometry) {
    console.log('Geometry not ready, rendering fallback');
         return (
       <mesh ref={meshRef}>
         <boxGeometry args={[1, 1, 1]} />
         <meshStandardMaterial color="#ffffff" />
       </mesh>
     );
  }
  
  return (
    <group>
      {/* Solid mesh */}
      <mesh 
        ref={meshRef}
        geometry={geometry}
        rotation={[0, Math.PI / 8, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial 
          color="#ffffff"
          metalness={0.1}
          roughness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Wireframe overlay */}
      <mesh 
        geometry={geometry}
        rotation={[0, Math.PI / 8, 0]}
      >
        <meshBasicMaterial
          color="#333333"
          wireframe={true}
          transparent={true}
          opacity={0.2}
        />
      </mesh>
    </group>
  );
};

// Camera controller for thumbnails
const ThumbnailCamera = ({ position = [5, 3, 5] }) => {
  const controlsRef = React.useRef();
  
  // Clean up controls on unmount
  React.useEffect(() => {
    return () => {
      // Safe cleanup of controls
      if (controlsRef.current) {
        try {
          // Check if controls are still valid before disposing
          if (controlsRef.current.domElement && typeof controlsRef.current.dispose === 'function') {
            controlsRef.current.dispose();
          }
        } catch (error) {
          // Silently handle disposal errors
          console.warn('Could not dispose thumbnail controls:', error);
        }
      }
    };
  }, []);
  
  return (
    <>
      <PerspectiveCamera 
        makeDefault 
        fov={10} 
        near={0.1} 
        far={1000}
        position={position}
      />
      <OrbitControls 
        ref={(ref) => {
          // Safely assign ref with error handling
          try {
            controlsRef.current = ref;
          } catch (error) {
            console.warn('OrbitControls ref assignment warning:', error);
          }
        }}
        enableZoom={true}
        enablePan={false}
        autoRotate={false}
        autoRotateSpeed={1}
        enableDamping={true}
        dampingFactor={0.05}
        makeDefault={false}
        target={[0, 0, 0]}
      />
    </>
  );
};

const ComparisonSummary = ({ fileIds }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filesData, setFilesData] = useState({});
  const [performanceData, setPerformanceData] = useState(null);
  
  // Colors for different files in the comparison
  const FILE_COLORS = [
    "#0173B2", // Blue
    "#CC78BC", // Purple
    "#029E73", // Green
    "#D55E00", // Orange
    "#EFE441", // Yellow
    "#56B4E9", // Light blue
    "#E69F00", // Brown
    "#9C755F"  // Darker brown
  ];

  // Function to calculate mesh dimensions in inches
  const calculateMeshDimensions = (vertices) => {
    if (!vertices || vertices.length === 0) return null;
    
    // Convert vertices to array of points
    const points = vertices.map(v => new THREE.Vector3(v[0], v[1], v[2]));
    
    // Calculate bounding box
    const box = new THREE.Box3().setFromPoints(points);
    
    // Get dimensions in meters
    const size = new THREE.Vector3();
    box.getSize(size);
    
    // Store both meters and inches
    return {
      meters: {
        width: size.x,
        height: size.y,
        depth: size.z
      },
      inches: {
        width: size.x * 39.3701,
        height: size.y * 39.3701,
        depth: size.z * 39.3701
      }
    };
  };
  
  // Fetch data for all files
  useEffect(() => {
    if (!fileIds || fileIds.length === 0) {
      // Clear data when no files are selected
      setFilesData({});
      setPerformanceData(null);
      setLoading(false);
      return;
    }
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      // Clear existing data immediately to prevent race conditions
      setFilesData({});
      setPerformanceData(null);
      
      try {
        // Fetch metadata for each file individually
        const metadataPromises = fileIds.map(fileId => 
          axios.get(`${config.API_URL}/metadata/${fileId}`)
        );
        
        // Fetch mesh data for each file individually
        const meshPromises = fileIds.map(fileId => 
          axios.get(`${config.API_URL}/mesh/${fileId}`)
        );
        
        // Fetch performance comparison data
        const performancePromise = axios.get(`${config.API_URL}/compare/performance?file_ids=${fileIds.join(',')}`);
        
        // Wait for all requests to complete
        const metadataResponses = await Promise.all(metadataPromises);
        const meshResponses = await Promise.all(meshPromises);
        const performanceResponse = await performancePromise;
        
        // Process the data
        const filesData = {};
        
        fileIds.forEach((fileId, index) => {
          const metadata = metadataResponses[index].data;
          const meshData = meshResponses[index].data.mesh_data;
          
          // Calculate mesh dimensions if vertices are available
          let dimensions = null;
          if (meshData && meshData.vertices) {
            dimensions = calculateMeshDimensions(meshData.vertices);
          }
          
          filesData[fileId] = {
            fileId,
            metadata,
            meshData,
            dimensions,
            color: FILE_COLORS[index % FILE_COLORS.length]
          };
        });
        
        setFilesData(filesData);
        setPerformanceData(performanceResponse.data);
      } catch (err) {
        console.error('Error fetching comparison data:', err);
        setError('Failed to load comparison data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [fileIds]);
  
  // Plot diffusion coefficient comparison
  const renderDiffusionPlot = () => {
    if (!performanceData) return null;
    
    const plotData = [];
    let frequencies = null;
    
    // Find the first file with performance data to get frequencies
    Object.values(performanceData).forEach(fileData => {
      if (!fileData.error && fileData.performance && fileData.performance.frequencies) {
        frequencies = fileData.performance.frequencies;
        return;
      }
    });
    
    if (!frequencies) return null;
    
    // Create data points for each frequency
    frequencies.forEach((freq, freqIndex) => {
      const dataPoint = { frequency: freq };
      
      // Add diffusion coefficient for each file
      Object.entries(performanceData).forEach(([fileId, fileData]) => {
        if (!fileData.error && fileData.performance && fileData.performance.d_coef_random) {
          const fileName = fileData.filename.replace(/\..+$/, ''); // Remove file extension
          dataPoint[`${fileName}_diffusion`] = fileData.performance.d_coef_random.normalized[freqIndex];
        }
      });
      
      plotData.push(dataPoint);
    });
    
    // Custom tick formatter for frequencies
    const formatFrequency = (value) => {
      if (value >= 1000) {
        return `${(value/1000).toFixed(0)}k`;
      }
      return value;
    };
    
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={plotData}
          margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
          <XAxis 
            dataKey="frequency" 
            scale="log" 
            domain={['dataMin', 'dataMax']}
            type="number"
            tickFormatter={formatFrequency}
            stroke="#666"
            tick={{ fontSize: 11 }}
          />
          <YAxis 
            domain={[0, 1]} 
            tickCount={6}
            stroke="#666"
            tick={{ fontSize: 11 }}
          />
          <Tooltip 
            formatter={(value) => [value.toFixed(2), '']}
            labelFormatter={(value) => `${value} Hz`}
          />
          <Legend 
            verticalAlign="top" 
            wrapperStyle={{ paddingBottom: '10px' }}
          />
          
          {Object.entries(performanceData).map(([fileId, fileData], index) => {
            if (fileData.error || !fileData.performance) return null;
            
            const fileName = fileData.filename.replace(/\..+$/, '');
            const color = FILE_COLORS[index % FILE_COLORS.length];
            
            return (
              <Line 
                key={fileId}
                type="monotone" 
                dataKey={`${fileName}_diffusion`} 
                name={`${fileName} - Diffusion`} 
                stroke={color} 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, fill: color, stroke: 'white', strokeWidth: 2 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    );
  };
  
  // Plot scattering coefficient comparison
  const renderScatteringPlot = () => {
    if (!performanceData) return null;
    
    const plotData = [];
    let frequencies = null;
    
    // Find the first file with performance data to get frequencies
    Object.values(performanceData).forEach(fileData => {
      if (!fileData.error && fileData.performance && fileData.performance.frequencies) {
        frequencies = fileData.performance.frequencies;
        return;
      }
    });
    
    if (!frequencies) return null;
    
    // Create data points for each frequency
    frequencies.forEach((freq, freqIndex) => {
      const dataPoint = { frequency: freq };
      
      // Add scattering coefficient for each file
      Object.entries(performanceData).forEach(([fileId, fileData]) => {
        if (!fileData.error && fileData.performance && fileData.performance.s_coef_random) {
          const fileName = fileData.filename.replace(/\..+$/, ''); // Remove file extension
          dataPoint[`${fileName}_scattering`] = fileData.performance.s_coef_random[freqIndex];
        }
      });
      
      plotData.push(dataPoint);
    });
    
    // Custom tick formatter for frequencies
    const formatFrequency = (value) => {
      if (value >= 1000) {
        return `${(value/1000).toFixed(0)}k`;
      }
      return value;
    };
    
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={plotData}
          margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
          <XAxis 
            dataKey="frequency" 
            scale="log" 
            domain={['dataMin', 'dataMax']}
            type="number"
            tickFormatter={formatFrequency}
            stroke="#666"
            tick={{ fontSize: 11 }}
          />
          <YAxis 
            domain={[0, 1]} 
            tickCount={6}
            stroke="#666"
            tick={{ fontSize: 11 }}
          />
          <Tooltip 
            formatter={(value) => [value.toFixed(2), '']}
            labelFormatter={(value) => `${value} Hz`}
          />
          <Legend 
            verticalAlign="top" 
            wrapperStyle={{ paddingBottom: '10px' }}
          />
          
          {Object.entries(performanceData).map(([fileId, fileData], index) => {
            if (fileData.error || !fileData.performance) return null;
            
            const fileName = fileData.filename.replace(/\..+$/, '');
            const color = FILE_COLORS[index % FILE_COLORS.length];
            
            return (
              <Line 
                key={fileId}
                type="monotone" 
                dataKey={`${fileName}_scattering`} 
                name={`${fileName} - Scattering`} 
                stroke={color} 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, fill: color, stroke: 'white', strokeWidth: 2 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    );
  };
  
  // Error boundary component for Canvas
  const CanvasErrorBoundary = ({ children, fileId }) => {
    const [hasError, setHasError] = React.useState(false);
    
    React.useEffect(() => {
      // Reset error state when fileId changes
      setHasError(false);
    }, [fileId]);
    
    React.useEffect(() => {
      // Add error listener for unhandled errors
      const handleError = (event) => {
        if (event.error && event.error.message && event.error.message.includes('addEventListener')) {
          console.warn('Canvas error caught by boundary:', event.error);
          setHasError(true);
        }
      };
      
      window.addEventListener('error', handleError);
      return () => window.removeEventListener('error', handleError);
    }, []);
    
    if (hasError) {
      return (
        <div className="mesh-preview-error">
          <p>3D preview unavailable</p>
          <button onClick={() => setHasError(false)} style={{marginTop: '5px', fontSize: '12px'}}>
            Retry
          </button>
        </div>
      );
    }
    
    return children;
  };

  // Render mesh grid with all models
  const renderMeshGrid = () => {
    // Add a key that changes when fileIds change to force re-render
    const gridKey = fileIds.join('-');
    
    return (
      <div className="mesh-grid" key={gridKey}>
        {Object.values(filesData).map((fileData, index) => {
          const { fileId, meshData, color } = fileData;
          
          if (!meshData || !meshData.vertices || !meshData.faces) {
            return (
              <div key={fileId} className="mesh-card">
                <div className="mesh-placeholder">
                  <p>No mesh data available</p>
                </div>
                <div className="mesh-title">{fileData.metadata.model}</div>
              </div>
            );
          }
          
          return (
            <div key={`${fileId}-${index}`} className="mesh-card">
              <div className="mesh-preview">
                <CanvasErrorBoundary fileId={fileId}>
                  <Canvas
                    key={`canvas-${fileId}-${index}`}
                    dpr={[1, 1.5]}
                    camera={{ position: [5, 3, 5], fov: 10 }}
                    onCreated={({ gl, scene, camera }) => {
                      try {
                        console.log(`Canvas created for fileId: ${fileId}, mesh vertices: ${meshData.vertices?.length || 0}`);
                        gl.setClearColor('#111827', 1);
                      } catch (error) {
                        console.warn('Canvas setup warning:', error);
                      }
                    }}
                  >
                    <color attach="background" args={["#111827"]} />
                    <ambientLight intensity={0.8} />
                    <directionalLight intensity={1.2} position={[10, 10, 10]} />
                    <directionalLight intensity={0.8} position={[-5, 5, -5]} />
                    
                    <ThumbnailMesh
                      key={`mesh-${fileId}`}
                      vertices={meshData.vertices}
                      faces={meshData.faces}
                      normals={meshData.normals}
                      color={color}
                    />
                    
                    <OrbitControls 
                      enableZoom={true}
                      enablePan={false}
                      autoRotate={false}
                      enableDamping={true}
                      dampingFactor={0.05}
                      makeDefault={false}
                    />
                  </Canvas>
                </CanvasErrorBoundary>
              </div>
              <div className="mesh-title">{fileData.metadata.model}</div>
            </div>
          );
        })}
      </div>
    );
  };
  
  // Render metadata comparison table
  const renderMetadataTable = () => {
    if (Object.keys(filesData).length === 0) return null;
    
    // Define key metadata fields to display
    const metadataFields = [
      { key: 'model', label: 'Model Name' },
      { key: 'dimensions', label: 'Dimensions (m)', customRender: (fileData) => {
        if (!fileData.dimensions) return 'N/A';
        return `${fileData.dimensions.meters.width.toFixed(3)} × ${fileData.dimensions.meters.height.toFixed(3)} × ${fileData.dimensions.meters.depth.toFixed(3)}`;
      }},
      { key: 'dimensions', label: 'Dimensions (in)', customRender: (fileData) => {
        if (!fileData.dimensions) return 'N/A';
        return `${fileData.dimensions.inches.width.toFixed(2)} × ${fileData.dimensions.inches.height.toFixed(2)} × ${fileData.dimensions.inches.depth.toFixed(2)}`;
      }},
      { key: 'incidence_angle', label: 'Incidence Angle' },
      { key: 'frequency_range', label: 'Frequency Range' },
      { key: 'method', label: 'Method' }
    ];
    
    // Function to get a nested property value
    const getNestedPropertyValue = (obj, path) => {
      const parts = path.split('.');
      let value = obj;
      
      for (const part of parts) {
        if (value === null || value === undefined) return 'N/A';
        value = value[part];
      }
      
      return value || 'N/A';
    };
    
    return (
      <table className="metadata-table">
        <thead>
          <tr>
            <th>Property</th>
            {Object.values(filesData).map((fileData) => (
              <th key={fileData.fileId}>
                {fileData.metadata.model}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metadataFields.filter(field => field.key !== 'model').map((field) => (
            <tr key={field.key + field.label}>
              <td className="property-name">{field.label}</td>
              {Object.values(filesData).map((fileData) => (
                <td key={fileData.fileId}>
                  {field.customRender ? field.customRender(fileData) : getNestedPropertyValue(fileData.metadata, field.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };
  
  if (loading) {
    return (
      <div className="comparison-loading">
        <div className="spinner"></div>
        <p>Loading comparison data...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="comparison-error">
        <div className="error-icon">❌</div>
        <p>{error}</p>
        <button className="retry-button" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }
  
  if (fileIds.length === 0) {
    return (
      <div className="comparison-empty">
        <p>Select files to compare using the file manager.</p>
      </div>
    );
  }
  
  return (
    <div className="comparison-summary" key={`summary-${fileIds.join('-')}`}>
      <h2>RPG Diffuser Comparison</h2>
      <p className="comparison-subtitle">Comparing {fileIds.length} acoustic products</p>
      
      <div className="comparison-grid">
        {/* Metadata comparison card */}
        <div className="comparison-card metadata-card">
          <h3>Product Specifications</h3>
          <div className="comparison-card-content">
            {renderMetadataTable()}
          </div>
        </div>
        
        {/* 3D Models comparison card */}
        <div className="comparison-card models-card">
          <h3>3D Model Comparison</h3>
          <div className="comparison-card-content">
            {renderMeshGrid()}
          </div>
        </div>
        
        {/* Diffusion coefficient comparison card */}
        <div className="comparison-card diffusion-card">
          <h3>Random Incidence Diffusion Coefficient</h3>
          <div className="comparison-card-content">
            {renderDiffusionPlot()}
          </div>
        </div>
        
        {/* Scattering coefficient comparison card */}
        <div className="comparison-card scattering-card">
          <h3>Scattering Coefficient</h3>
          <div className="comparison-card-content">
            {renderScatteringPlot()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonSummary; 