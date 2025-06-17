import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Plot from 'react-plotly.js';
import SourceAngleVisualizer from './SourceAngleVisualizer';
import './PolarComparison.css';
import config from '../config';

const PolarComparison = ({ fileIds }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [polarData, setPolarData] = useState(null);
  
  // UI State
  const [selectedFrequencyIndex, setSelectedFrequencyIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('diffusor');
  const [showMarkers, setShowMarkers] = useState(false);
  
  // Source selection state
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const [sourceAngles, setSourceAngles] = useState([]);
  
  // Colors for different products
  const PRODUCT_COLORS = [
    "#0173B2", // Blue
    "#CC78BC", // Purple
    "#029E73", // Green
    "#D55E00", // Orange
    "#EFE441", // Yellow
    "#56B4E9", // Light blue
    "#E69F00", // Brown
    "#9C755F"  // Darker brown
  ];
  
  // Fetch polar response data for all files
  const fetchData = useCallback(async () => {
    if (!fileIds || fileIds.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all frequency data for selected source angle
      const response = await axios.get(`${config.API_URL}/compare/polar?file_ids=${fileIds.join(',')}&source_index=${selectedSourceIndex}`);
      setPolarData(response.data);
      
      // Set the frequency index based on the response
      if (response.data.common_frequencies) {
        setSelectedFrequencyIndex(prev => {
          // If the current index is valid, keep it; otherwise use middle frequency
          const freqCount = response.data.common_frequencies.length;
          return (prev < freqCount) ? prev : Math.floor(freqCount / 2);
        });
      }
      
      // Set source angles from the first file that has them
      if (response.data.source_angles && response.data.source_angles.length > 0) {
        setSourceAngles(response.data.source_angles);
      }
    } catch (err) {
      console.error('Error fetching polar comparison data:', err);
      setError('Failed to load polar response data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fileIds, selectedSourceIndex]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Render polar response plot
  const renderPolarPlot = () => {
    if (!polarData || !polarData.results) return null;
    
    const traces = [];
    
    // We need receiver angles and frequencies to create plot
    const commonFrequencies = polarData.common_frequencies;
    if (!commonFrequencies || commonFrequencies.length === 0) {
      return <div className="plot-error">No frequency data available</div>;
    }
    
    // Process each file's data
    Object.entries(polarData.results).forEach(([fileId, fileData], index) => {
      if (fileData.error) return;
      
      const color = PRODUCT_COLORS[index % PRODUCT_COLORS.length];
      const receiverAngles = fileData.receiver_angles;
      
      if (!receiverAngles) return;
      
      // Convert angles from radians to degrees if needed and map to polar coordinates
      const anglesInDegrees = receiverAngles.map(angle => {
        // Determine if the angle is already in degrees or radians
        let angleInDegrees = Math.abs(angle) > Math.PI ? angle : angle * (180/Math.PI);
        // Map acoustic angles (-90 to +90) to polar coordinates (0 to 180)
        // -90° → 180°, 0° → 90°, +90° → 0°
        return 90 - angleInDegrees;
      });
      
      // Get data for the selected frequency and source (all frequencies are now stored locally)
      let sourceData;
      if (activeTab === 'diffusor') {
        if (!fileData.scattered_pressure_diffusor_all_freq || 
            !fileData.scattered_pressure_diffusor_all_freq[selectedFrequencyIndex]) {
          return;
        }
        sourceData = fileData.scattered_pressure_diffusor_all_freq[selectedFrequencyIndex];
      } else {
        if (!fileData.scattered_pressure_reflector_all_freq || 
            !fileData.scattered_pressure_reflector_all_freq[selectedFrequencyIndex]) {
          return;
        }
        sourceData = fileData.scattered_pressure_reflector_all_freq[selectedFrequencyIndex];
      }
      
      // Take the portion that corresponds to single plane
      const dataLength = receiverAngles.length;
      const plotData = sourceData.slice(-dataLength);
      
      // Normalize the data (find max for this source data)
      const maxPressure = Math.max(...plotData);
      const normalizedData = plotData.map(val => val - maxPressure);
      
      traces.push({
        type: 'scatterpolar',
        r: normalizedData,
        theta: anglesInDegrees,
        name: fileData.filename,
        line: {
          color,
          width: 2.5
        },
        marker: {
          size: showMarkers ? 5 : 0,
          color,
          symbol: 'circle'
        },
        showlegend: true,
        opacity: 0.8
      });
    });
    
    if (traces.length === 0) {
      return <div className="plot-error">No valid polar response data available</div>;
    }
    
    // Layout configuration for a polar plot
    const layout = {
      title: {
        text: `${activeTab === 'diffusor' ? 'Diffusor' : 'Reflector'} Polar Response at ${Math.round(commonFrequencies[selectedFrequencyIndex])} Hz`,
        font: { size: 18, color: '#444' }
      },
      polar: {
        sector: [0, 180],
        radialaxis: {
          // Adjust range to account for potentially negative values in normalized data
          range: [-50, 10],
          
          angle: 90,
          tickfont: { size: 10, color: '#666' },
          gridcolor: 'rgba(200, 200, 200, 0.3)',
          linecolor: 'rgba(200, 200, 200, 0.5)'
        },
        angularaxis: {
          direction: 'clockwise',
          rotation: 180, // Start at right, we'll map data accordingly
          range: [0, 180],
          tickmode: 'array',
          tickvals: [0, 30, 60, 90, 120, 150, 180],
          ticktext: ['-90°', '-60°', '-30°', '0°', '30°', '60°', '90°'],
          tickfont: { color: '#666' },
          gridcolor: 'rgba(200, 200, 200, 0.3)',
          linecolor: 'rgba(200, 200, 200, 0.5)'
        },
        bgcolor: 'rgba(250, 250, 250, 0)'
      },
      showlegend: true,
      legend: {
        x: 0.02,
        y: 0.98,
        bgcolor: 'rgba(255, 255, 255, 0.7)',
        bordercolor: '#E2E2E2',
        borderwidth: 1,
        font: { size: 12 }
      },
      margin: { l: 40, r: 40, t: 60, b: 40 },
      paper_bgcolor: 'rgba(0, 0, 0, 0)',
      plot_bgcolor: 'rgba(0, 0, 0, 0)',
      // height: 600,
      autosize: true
    };
    
    return (
      <Plot 
        data={traces}
        layout={layout}
        config={{
          displayModeBar: true,
          displaylogo: false,
          responsive: false,
          scrollZoom: false,
          doubleClick: true,
          staticPlot: true,
          modeBarButtonsToRemove: ['lasso2d', 'select2d', 'zoom2d', 'pan2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d']
        }}
        style={{ width: '100%', height: '600px' }}
        useResizeHandler={true}
      />
    );
  };
  
  // Helper to format source angle display
  const formatAngle = (angle) => {
    if (!angle) return '';
    return `${angle[0].toFixed(1)}° (az), ${angle[1].toFixed(1)}° (el)`;
  };
  
  // Render plot with loading state overlay if needed
  const renderPlotContent = () => {
    if (loading) {
      return (
        <div className="polar-comparison-loading">
          <div className="spinner"></div>
          <p>Loading polar response data...</p>
        </div>
      );
    }
    
    return renderPolarPlot();
  };
  
  if (error) {
    return (
      <div className="polar-comparison-error">
        <div className="error-icon">❌</div>
        <p>{error}</p>
        <button className="retry-button" onClick={fetchData}>Retry</button>
      </div>
    );
  }
  
  if (fileIds.length === 0) {
    return (
      <div className="polar-comparison-empty">
        <p>Select files to compare using the file manager.</p>
      </div>
    );
  }
  
  return (
    <div className="polar-comparison">
      <h2>Polar Response Comparison</h2>
      
      <div className="controls">
        <div className="tab-controls">
          <button 
            className={`tab-button ${activeTab === 'diffusor' ? 'active' : ''}`}
            onClick={() => setActiveTab('diffusor')}
          >
            Diffusor Response
          </button>
          <button 
            className={`tab-button ${activeTab === 'reflector' ? 'active' : ''}`}
            onClick={() => setActiveTab('reflector')}
          >
            Reflector Response
          </button>
        </div>
        
        <div className="view-options">
          <label className="marker-toggle">
            <input 
              type="checkbox"
              checked={showMarkers}
              onChange={() => setShowMarkers(!showMarkers)}
            />
            Show Data Points
          </label>
        </div>
      </div>
      
      <div className="polar-layout">
        {/* Source selector card */}
        {sourceAngles.length > 0 && (
          <div className="source-visualizer-wrapper">
            <div className="source-visualizer-header">
              <h3>Source Angle Selection</h3>
              <div className="source-selector-container">
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
            </div>
            <div className="source-visualizer-container-fixed">
              <SourceAngleVisualizer 
                sourceAngles={sourceAngles}
                selectedIndex={selectedSourceIndex}
                isRandomMode={false}
                onSelectSource={(index) => setSelectedSourceIndex(index)}
              />
            </div>
          </div>
        )}
        
        <div className="plot-container">
          {renderPlotContent()}
        </div>
      </div>
      
      {/* Frequency slider */}
      {polarData && polarData.common_frequencies && (
        <div className="frequency-control">
          <div className="frequency-info">
            <span className="frequency-label">Frequency:</span>
            <span className="frequency-value">
              {Math.round(polarData.common_frequencies[selectedFrequencyIndex])} Hz
            </span>
          </div>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max={polarData.common_frequencies.length - 1}
              value={selectedFrequencyIndex}
              onChange={(e) => setSelectedFrequencyIndex(parseInt(e.target.value))}
              className="frequency-slider"
            />
          </div>
          <div className="slider-range-labels">
            <span>{Math.round(polarData.common_frequencies[0])} Hz</span>
            <span>{Math.round(polarData.common_frequencies[polarData.common_frequencies.length - 1])} Hz</span>
          </div>
        </div>
      )}
      
      <div className="explanation">
        <h3>About Polar Responses</h3>
        <p>
          Polar response plots show the angular distribution of sound reflection or diffusion. The distance from 
          the center represents the sound pressure level at each angle, normalized relative to the maximum value.
          Products with more uniform polar responses (closer to circular shape) provide more evenly distributed 
          sound diffusion.
        </p>
        <div className="file-list">
          <h4>Comparing {fileIds.length} products:</h4>
          <ul className="product-list">
            {polarData && polarData.results && Object.entries(polarData.results).map(([fileId, fileData], index) => (
              <li key={fileId} className="product-item">
                <span className="color-dot" style={{ backgroundColor: PRODUCT_COLORS[index % PRODUCT_COLORS.length] }}></span>
                {fileData.filename || 'Unknown Product'}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PolarComparison; 