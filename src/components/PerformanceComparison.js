import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Plot from 'react-plotly.js';
import SourceAngleVisualizer from './SourceAngleVisualizer';
import './PerformanceComparison.css';
import config from '../config';

const PerformanceComparison = ({ fileIds }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  
  // UI State
  const [activeMetrics, setActiveMetrics] = useState(['d_coef_random.normalized', 's_coef_random']);
  const [showLegend, setShowLegend] = useState(true);
  const [incidenceType, setIncidenceType] = useState('random');
  const [sourceAngleIndex, setSourceAngleIndex] = useState(0);
  const [sourceAngles, setSourceAngles] = useState([]);
  
  // Colors for different products
  const PRODUCT_COLORS = [
    '#636EFA', // Blue
    '#EF553B', // Red
    '#00CC96', // Green
    '#AB63FA', // Purple
    '#FFA15A', // Orange
    '#19D3F3', // Light Blue
    '#FF6692', // Pink
    '#B6E880', // Light Green
    '#FF97FF', // Light Purple
    '#FECB52'  // Yellow
  ];
  
  // Line styles for different metrics
  const LINE_STYLES = ['solid', 'dot', 'dashdot', 'longdash', 'dash', 'longdashdot'];
  
  // Fetch performance data for all files
  useEffect(() => {
    if (!fileIds || fileIds.length === 0) return;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch performance data for all selected files
        const response = await axios.get(`${config.API_URL}/compare/performance?file_ids=${fileIds.join(',')}`);
        setPerformanceData(response.data);
        
        // Find source angles from the first file that has them
        const firstFileWithAngles = Object.values(response.data).find(
          fileData => fileData.performance && fileData.performance.source_angles && fileData.performance.source_angles.length > 0
        );
        
        if (firstFileWithAngles && firstFileWithAngles.performance.source_angles) {
          setSourceAngles(firstFileWithAngles.performance.source_angles);
        }
      } catch (err) {
        console.error('Error fetching performance data:', err);
        setError('Failed to load performance data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [fileIds]);
  
  // Update selected metrics when incidence type changes
  useEffect(() => {
    const updateMetrics = () => {
      // Map current metrics to the new incidence type
      const updatedMetrics = activeMetrics.map(metric => {
        if (incidenceType === 'random') {
          return metric.replace('angular', 'random');
        } else {
          return metric.replace('random', 'angular');
        }
      });
      
      // Ensure normalized diffusion and scattering are always selected by default
      const defaultMetrics = incidenceType === 'random' 
        ? ['d_coef_random.normalized', 's_coef_random']
        : ['d_coef_angular.normalized', 's_coef_angular'];
      
      const combinedMetrics = [...new Set([...updatedMetrics, ...defaultMetrics])];
      setActiveMetrics(combinedMetrics);
    };
    
    updateMetrics();
  }, [incidenceType]);
  
  // Get friendly metric name
  const getMetricName = (metric) => {
    switch (metric) {
      case 'd_coef_random.normalized':
      case 'd_coef_angular.normalized':
        return 'Normalized Diffusion Coefficient';
      case 'd_coef_random.diffusor':
      case 'd_coef_angular.diffusor':
        return 'Diffusor Diffusion Coefficient';
      case 'd_coef_random.reflector':
      case 'd_coef_angular.reflector':
        return 'Reflector Diffusion Coefficient';
      case 's_coef_random':
      case 's_coef_angular':
        return 'Scattering Coefficient';
      default:
        return metric;
    }
  };
  
  // Helper to format source angle display
  const formatAngle = (angle) => {
    if (!angle) return '';
    return `${angle[0].toFixed(1)}° (az), ${angle[1].toFixed(1)}° (el)`;
  };
  
  // Toggle a metric in the selection
  const toggleMetric = (metric) => {
    setActiveMetrics(prevMetrics => {
      if (prevMetrics.includes(metric)) {
        // Remove metric if it's already selected
        return prevMetrics.filter(m => m !== metric);
      } else {
        // Add metric if it's not selected
        return [...prevMetrics, metric];
      }
    });
  };
  
  // Render diffusion coefficient plot
  const renderPerformancePlot = () => {
    if (!performanceData) return null;
    
    const traces = [];
    let commonFrequencies = null;
    
    // Find common frequencies among all files
    Object.entries(performanceData).forEach(([fileId, fileData]) => {
      if (fileData.error || !fileData.performance || !fileData.performance.frequencies) return;
      
      if (!commonFrequencies) {
        commonFrequencies = fileData.performance.frequencies;
      }
    });
    
    if (!commonFrequencies) {
      return <div className="plot-error">No frequency data available</div>;
    }
    
    // Create traces for each file and selected metric
    Object.entries(performanceData).forEach(([fileId, fileData], fileIndex) => {
      if (fileData.error || !fileData.performance) return;
      
      const color = PRODUCT_COLORS[fileIndex % PRODUCT_COLORS.length];
      
      // Process each selected metric
      activeMetrics.forEach((metric, metricIndex) => {
        let yValues;
        
        if (incidenceType === 'random') {
          // Select data based on active metric for random incidence
          if (metric === 'd_coef_random.normalized') {
            yValues = fileData.performance.d_coef_random.normalized;
          } else if (metric === 'd_coef_random.diffusor') {
            yValues = fileData.performance.d_coef_random.diffusor;
          } else if (metric === 'd_coef_random.reflector') {
            yValues = fileData.performance.d_coef_random.reflector;
          } else if (metric === 's_coef_random') {
            yValues = fileData.performance.s_coef_random;
          }
        } else {
          // Select data based on active metric for angular incidence
          if (metric === 'd_coef_angular.normalized') {
            if (fileData.performance.d_coef_angular && fileData.performance.d_coef_angular.normalized) {
              yValues = fileData.performance.d_coef_angular.normalized[sourceAngleIndex];
            }
          } else if (metric === 'd_coef_angular.diffusor') {
            if (fileData.performance.d_coef_angular && fileData.performance.d_coef_angular.diffusor) {
              yValues = fileData.performance.d_coef_angular.diffusor[sourceAngleIndex];
            }
          } else if (metric === 'd_coef_angular.reflector') {
            if (fileData.performance.d_coef_angular && fileData.performance.d_coef_angular.reflector) {
              yValues = fileData.performance.d_coef_angular.reflector[sourceAngleIndex];
            }
          } else if (metric === 's_coef_angular') {
            if (fileData.performance.s_coef_angular) {
              yValues = fileData.performance.s_coef_angular[sourceAngleIndex];
            }
          }
        }
        
        // Add trace if data is available
        if (yValues) {
          const dashStyle = LINE_STYLES[metricIndex % LINE_STYLES.length];
          const metricName = getMetricName(metric);
          
          traces.push({
            x: fileData.performance.frequencies,
            y: yValues,
            type: 'scatter',
            mode: 'lines+markers',
            name: `${fileData.filename} - ${metricName}`,
            line: { color, width: 2, dash: dashStyle },
            marker: { size: 6 },
            showlegend: showLegend
          });
        }
      });
    });
    
    // Create layout
    const layout = {
      title: `Performance Metrics Comparison - ${incidenceType === 'random' ? 'Random Incidence' : `Angular Incidence (${formatAngle(sourceAngles[sourceAngleIndex])})`}`,
      xaxis: {
        title: 'Frequency (Hz)',
        type: 'log',
        range: [Math.log10(Math.min(...commonFrequencies) * 0.9), Math.log10(Math.max(...commonFrequencies) * 1.1)],
        tickmode: 'array',
        ticktext: ['125', '250', '500', '1k', '2k', '4k', '8k', '16k'],
        tickvals: [125, 250, 500, 1000, 2000, 4000, 8000, 16000]
      },
      yaxis: {
        title: 'Coefficient Value',
        range: [-0.1, 1.1],
        autorange: false,
        tickformat: '.1f'
      },
      hovermode: 'closest',
      legend: {
        orientation: 'h',
        yanchor: 'bottom',
        y: 1.02,
        xanchor: 'right',
        x: 1
      },
      margin: { l: 60, r: 40, t: 80, b: 80 },
      autosize: true,
      height: 600
    };
    
    // Add standard frequency bands
    const standardBands = [125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    const minFreq = Math.min(...commonFrequencies);
    const maxFreq = Math.max(...commonFrequencies);
    
    const shapes = standardBands
      .filter(band => band >= minFreq && band <= maxFreq)
      .map(band => ({
        type: 'line',
        x0: band,
        x1: band,
        y0: -0.1,
        y1: 1.1,
        line: {
          color: 'rgba(200,200,200,0.5)',
          width: 1,
          dash: 'dash'
        }
      }));
    
    layout.shapes = shapes;
    
    return (
      <Plot 
        data={traces}
        layout={{
          ...layout,
          autosize: true,
          height: undefined
        }}
        config={{
          displayModeBar: false,
          displaylogo: false,
          responsive: true
        }}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler={true}
        className="performance-plot"
      />
    );
  };
  
  // Calculate average performance metrics for each product
  const calculateAverageMetrics = () => {
    if (!performanceData) return [];
    
    const metrics = [];
    
    Object.entries(performanceData).forEach(([fileId, fileData], index) => {
      if (fileData.error || !fileData.performance) return;
      
      const frequencies = fileData.performance.frequencies;
      
      // Select the correct data source based on incidence type
      let normalizedDiffusion, scatteringCoef;
      
      if (incidenceType === 'random') {
        normalizedDiffusion = fileData.performance.d_coef_random.normalized;
        scatteringCoef = fileData.performance.s_coef_random;
      } else {
        // Angular incidence data
        if (fileData.performance.d_coef_angular &&
            fileData.performance.d_coef_angular.normalized &&
            fileData.performance.s_coef_angular) {
          normalizedDiffusion = fileData.performance.d_coef_angular.normalized[sourceAngleIndex];
          scatteringCoef = fileData.performance.s_coef_angular[sourceAngleIndex];
        } else {
          // If angular data not available, skip this file
          return;
        }
      }
      
      // Check if all necessary data is available
      if (!normalizedDiffusion || !scatteringCoef) {
        return;
      }
      
      // Calculate averages
      const avgDiffusion = normalizedDiffusion.reduce((sum, val) => sum + val, 0) / normalizedDiffusion.length;
      const avgScattering = scatteringCoef.reduce((sum, val) => sum + val, 0) / scatteringCoef.length;
      
      // Find peak diffusion
      const peakDiffusion = Math.max(...normalizedDiffusion);
      const peakDiffusionIndex = normalizedDiffusion.indexOf(peakDiffusion);
      const peakDiffusionFreq = frequencies[peakDiffusionIndex];
      
      // Find peak scattering
      const peakScattering = Math.max(...scatteringCoef);
      const peakScatteringIndex = scatteringCoef.indexOf(peakScattering);
      const peakScatteringFreq = frequencies[peakScatteringIndex];
      
      metrics.push({
        fileId,
        filename: fileData.filename,
        color: PRODUCT_COLORS[index % PRODUCT_COLORS.length],
        avgDiffusion: avgDiffusion.toFixed(2),
        peakDiffusion: peakDiffusion.toFixed(2),
        peakDiffusionFreq: Math.round(peakDiffusionFreq),
        avgScattering: avgScattering.toFixed(2),
        peakScattering: peakScattering.toFixed(2),
        peakScatteringFreq: Math.round(peakScatteringFreq)
      });
    });
    
    return metrics;
  };
  
  // Calculate and display numeric results for the products
  const renderMetricsTable = () => {
    const metrics = calculateAverageMetrics();
    
    if (metrics.length === 0) {
      return <div className="no-metrics">No metrics data available for the selected incidence type</div>;
    }
    
    return (
      <table className="metrics-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Avg Diffusion</th>
            <th>Peak Diffusion</th>
            <th>Peak Freq (Hz)</th>
            <th>Avg Scattering</th>
            <th>Peak Scattering</th>
            <th>Peak Freq (Hz)</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.fileId}>
              <td>
                <div className="product-name">
                  <span className="color-dot" style={{ backgroundColor: metric.color }}></span>
                  {metric.filename}
                </div>
              </td>
              <td>{metric.avgDiffusion}</td>
              <td>{metric.peakDiffusion}</td>
              <td>{metric.peakDiffusionFreq}</td>
              <td>{metric.avgScattering}</td>
              <td>{metric.peakScattering}</td>
              <td>{metric.peakScatteringFreq}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };
  
  if (loading) {
    return (
      <div className="performance-comparison-loading">
        <div className="spinner"></div>
        <p>Loading performance data...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="performance-comparison-error">
        <div className="error-icon">❌</div>
        <p>{error}</p>
        <button className="retry-button" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }
  
  if (fileIds.length === 0) {
    return (
      <div className="performance-comparison-empty">
        <p>Select files to compare using the file manager.</p>
      </div>
    );
  }
  
  return (
    <div className="performance-comparison">
      <h2>Performance Metrics Comparison</h2>
      
      <div className="performance-layout">
        {/* Vertical tabs on the left */}
        <div className="performance-tabs">
          <div className="tab-group">
            <h3>Incidence Type</h3>
            <div className="vertical-tabs">
              <button 
                className={`tab-button ${incidenceType === 'random' ? 'active' : ''}`}
                onClick={() => setIncidenceType('random')}
              >
                Random Incidence
              </button>
              <button 
                className={`tab-button ${incidenceType === 'angular' ? 'active' : ''}`}
                onClick={() => setIncidenceType('angular')}
                disabled={!sourceAngles.length}
              >
                Angular Incidence
              </button>
            </div>
          </div>
          
          <div className="tab-group">
            <h3>Metrics</h3>
            <div className="vertical-tabs">
              {incidenceType === 'random' ? (
                <>
                  <button 
                    className={`tab-button ${activeMetrics.includes('d_coef_random.normalized') ? 'active' : ''}`}
                    onClick={() => toggleMetric('d_coef_random.normalized')}
                  >
                    Normalized Diffusion Coefficient
                  </button>
                  <button 
                    className={`tab-button ${activeMetrics.includes('d_coef_random.diffusor') ? 'active' : ''}`}
                    onClick={() => toggleMetric('d_coef_random.diffusor')}
                  >
                    Diffusor Diffusion Coefficient
                  </button>
                  <button 
                    className={`tab-button ${activeMetrics.includes('d_coef_random.reflector') ? 'active' : ''}`}
                    onClick={() => toggleMetric('d_coef_random.reflector')}
                  >
                    Reflector Diffusion Coefficient
                  </button>
                  <button 
                    className={`tab-button ${activeMetrics.includes('s_coef_random') ? 'active' : ''}`}
                    onClick={() => toggleMetric('s_coef_random')}
                  >
                    Scattering Coefficient
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className={`tab-button ${activeMetrics.includes('d_coef_angular.normalized') ? 'active' : ''}`}
                    onClick={() => toggleMetric('d_coef_angular.normalized')}
                  >
                    Normalized Diffusion Coefficient
                  </button>
                  <button 
                    className={`tab-button ${activeMetrics.includes('d_coef_angular.diffusor') ? 'active' : ''}`}
                    onClick={() => toggleMetric('d_coef_angular.diffusor')}
                  >
                    Diffusor Diffusion Coefficient
                  </button>
                  <button 
                    className={`tab-button ${activeMetrics.includes('d_coef_angular.reflector') ? 'active' : ''}`}
                    onClick={() => toggleMetric('d_coef_angular.reflector')}
                  >
                    Reflector Diffusion Coefficient
                  </button>
                  <button 
                    className={`tab-button ${activeMetrics.includes('s_coef_angular') ? 'active' : ''}`}
                    onClick={() => toggleMetric('s_coef_angular')}
                  >
                    Scattering Coefficient
                  </button>
                </>
              )}
            </div>
          </div>
          
          {incidenceType === 'angular' && sourceAngles.length > 0 && (
            <div className="tab-group">
              <h3>Source Angle</h3>
              <select 
                className="angle-selector"
                value={sourceAngleIndex}
                onChange={(e) => setSourceAngleIndex(parseInt(e.target.value))}
              >
                {sourceAngles.map((angle, index) => (
                  <option key={index} value={index}>
                    Source {index + 1}: {formatAngle(angle)}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Source Angle Visualizer */}
          {sourceAngles.length > 0 && (
            <div className="tab-group visualizer-tab">
              <h3>Source Positions</h3>
              <div className="visualizer-container">
                <SourceAngleVisualizer 
                  sourceAngles={sourceAngles}
                  selectedIndex={sourceAngleIndex}
                  isRandomMode={incidenceType === 'random'}
                  onSelectSource={(index) => {
                    setSourceAngleIndex(index);
                    setIncidenceType('angular');
                  }}
                />
              </div>
            </div>
          )}
          
          <div className="tab-group">
            <h3>View Options</h3>
            <div className="view-options">
              <label className="legend-toggle">
                <input 
                  type="checkbox"
                  checked={showLegend}
                  onChange={() => setShowLegend(!showLegend)}
                />
                Show Legend
              </label>
            </div>
          </div>
        </div>
        
        {/* Main content area on the right */}
        <div className="performance-content">
          <div className="plot-container">
            {renderPerformancePlot()}
          </div>
          
          <div className="metrics-summary">
            <h3>Performance Summary - {incidenceType === 'random' ? 'Random Incidence' : `Source ${sourceAngleIndex + 1}`}</h3>
            {renderMetricsTable()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceComparison; 