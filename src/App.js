import React, { useState, useEffect, useRef } from 'react';
import FileUpload from './components/FileUpload';
import FileManager from './components/FileManager';
import ComparisonSummary from './components/ComparisonSummary'; 
import PerformanceComparison from './components/PerformanceComparison';
import PolarComparison from './components/PolarComparison';
import PolarComparison3D from './components/PolarComparison3D';
import MeshComparison from './components/MeshComparison';
import './App.css';
import rpgLogo from './assets/rpg_logo.png';
import axios from 'axios';
import config from './config';

function App() {
  // State for files
  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState('upload');
  
  // Reference for file input
  const fileInputRef = useRef(null);

  // Load files on initial render
  useEffect(() => {
    fetchFiles();
  }, []);

  // Fetch files from the server
  const fetchFiles = async () => {
    try {
      const response = await axios.get(`${config.API_URL}/files`);
      setFiles(response.data.files || []);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleFileUploaded = (data) => {
    // Add the new file to the files list
    setFiles(prevFiles => [...prevFiles, data]);
    
    // Switch to comparison summary tab if we're on the upload tab
    if (activeTab === 'upload') {
      setActiveTab('comparisonSummary');
    }
    
    // Add the file to selected files for comparison if not already present
    setSelectedFileIds(prevIds => {
      if (!prevIds.includes(data.file_id)) {
        return [...prevIds, data.file_id];
      }
      return prevIds;
    });
  };

  const handleFileDelete = async (fileId) => {
    try {
      await axios.delete(`${config.API_URL}/files/${fileId}`);

      // Update files and UI state in a single state updater to avoid relying on stale state
      setFiles(prevFiles => {
        const updatedFiles = prevFiles.filter(file => file.file_id !== fileId);

        // If no files remain after deletion, navigate back to the upload tab
        if (updatedFiles.length === 0) {
          setActiveTab('upload');
        }

        return updatedFiles;
      });

      // Remove the deleted file from the current comparison selection
      setSelectedFileIds(prevIds => prevIds.filter(id => id !== fileId));
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleComparisonToggle = (fileId) => {
    setSelectedFileIds(prevIds => {
      if (prevIds.includes(fileId)) {
        return prevIds.filter(id => id !== fileId);
      } else {
        return [...prevIds, fileId];
      }
    });
  };



  // Handle direct file selection
  const handleDirectFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      // Use the existing upload logic from FileUpload
      handleFileUpload(files);
    }
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    // For single file upload
    if (files.length === 1) {
      const file = files[0];
      
      // Check if the file is an HDF5 file
      if (!file.name.endsWith('.h5') && !file.name.endsWith('.hdf5')) {
        console.error('Invalid file format');
        return;
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await axios.post(`${config.API_URL}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        // Notify about successful upload
        handleFileUploaded(response.data);
      } catch (error) {
        console.error('Upload failed:', error);
      }
      return;
    }
    
    // For multiple files
    const formData = new FormData();
    
    // Append all valid files
    files.forEach(file => {
      if (file.name.endsWith('.h5') || file.name.endsWith('.hdf5')) {
        formData.append('files', file);
      }
    });
    
    try {
      const response = await axios.post(`${config.API_URL}/upload_multiple`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Handle the response
      if (response.data.results) {
        response.data.results.forEach(result => {
          // Notify parent component for each successful upload
          handleFileUploaded(result);
        });
      }
    } catch (error) {
      console.error('Multiple file upload failed:', error);
    }
  };

  const hasSelectedFiles = selectedFileIds.length > 0;
  
  return (
    <div className="App">
      {/* Hidden file input for direct file selection */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
        multiple
        accept=".h5,.hdf5"
      />
      
      <header className="App-header">
        <div className="header-content">
          <div className="logo-container">
            <img src={rpgLogo} alt="RPG Diffusor Visualizer" className="app-logo" />
            <div className="title-container">
              <h1>RPG Diffusor Comparison Platform</h1>
              <p className="subtitle">Advanced acoustic analysis & comparison platform</p>
            </div>
          </div>
          

          
          {files.length > 0 && (
            <div className="tab-navigation">
              <button 
                className={`tab-button ${activeTab === 'comparisonSummary' ? 'active' : ''}`}
                onClick={() => setActiveTab('comparisonSummary')}
              >
                Comparison Summary
              </button>
              <button 
                className={`tab-button ${activeTab === 'performanceComparison' ? 'active' : ''}`}
                onClick={() => setActiveTab('performanceComparison')}
              >
                Performance Comparison
              </button>
              <button 
                className={`tab-button ${activeTab === 'polarComparison' ? 'active' : ''}`}
                onClick={() => setActiveTab('polarComparison')}
              >
                Polar Response Comparison
              </button>
              <button 
                className={`tab-button ${activeTab === 'polarComparison3D' ? 'active' : ''}`}
                onClick={() => setActiveTab('polarComparison3D')}
              >
                3D Polar Comparison
              </button>
              <button 
                className={`tab-button ${activeTab === 'meshComparison' ? 'active' : ''}`}
                onClick={() => setActiveTab('meshComparison')}
              >
                3D Mesh Comparison
              </button>
            </div>
          )}
        </div>
      </header>
      
      <main className="App-main">
        {files.length === 0 ? (
          <div className="welcome-container">
            <div className="welcome-content">
              <h2>Welcome to RPG Diffusor Comparison Platform</h2>
              <p>
                A professional platform for analyzing and comparing acoustic products, featuring 3D polar response visualization, 
                diffusion metrics, and performance data.
              </p>
              <FileUpload onFileUploaded={handleFileUploaded} />
            </div>
          </div>
        ) : (
          <div className="content-container">
            {/* File management sidebar */}
            <div className="file-management-sidebar">
              <FileManager 
                files={files}
                selectedFileIds={selectedFileIds}
                onFileDelete={handleFileDelete}
                onComparisonToggle={handleComparisonToggle}
                onUploadNew={handleDirectFileSelect}
              />
              
              {/* {activeTab === 'upload' && (
                <div className="upload-area">
                  <h3>Upload New File</h3>
                  <FileUpload onFileUploaded={handleFileUploaded} />
                </div>
              )} */}
            </div>
            
            {/* Main content area */}
            <div className="main-content-area">
                            {/* Comparison views */}
              <div className={`visualization-container ${activeTab === 'comparisonSummary' ? 'visible' : ''}`}>
                <ComparisonSummary 
                  fileIds={selectedFileIds} 
                />
              </div>
              
              {activeTab === 'performanceComparison' && (
                <div className="performance-comparison-container visible">
                  <PerformanceComparison fileIds={selectedFileIds} />
                </div>
              )}
              
              {activeTab === 'polarComparison' && (
                <div className="polar-comparison-container visible">
                  <PolarComparison fileIds={selectedFileIds} />
                </div>
              )}
              
              {activeTab === 'polarComparison3D' && (
                <div className="polar-comparison-3d-container visible">
                  <PolarComparison3D fileIds={selectedFileIds} />
                </div>
              )}
              
              {activeTab === 'meshComparison' && (
                <div className="mesh-comparison-container visible">
                  <MeshComparison fileIds={selectedFileIds} />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      
      <footer className="App-footer">
        <p>RPG Diffusor Comparison Platform &copy; {new Date().getFullYear()} | <a href="#about">About</a> | <a href="#contact">Contact</a></p>
      </footer>
    </div>
  );
}

export default App; 