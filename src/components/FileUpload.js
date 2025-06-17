import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './FileUpload.css';
import config from '../config';

const FileUpload = ({ onFileUploaded }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState([]);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Open file dialog automatically when component is mounted
  useEffect(() => {
    // Delay slightly to ensure DOM is ready
    const timer = setTimeout(() => {
      fileInputRef.current.click();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    setError(null);
    
    // Initialize progress tracking for each file
    setUploadProgress(files.map(file => ({
      name: file.name,
      progress: 0,
      complete: false
    })));
    
    // For single file upload, use the old endpoint
    if (files.length === 1) {
      const file = files[0];
      
      // Check if the file is an HDF5 file
      if (!file.name.endsWith('.h5') && !file.name.endsWith('.hdf5')) {
        setUploadProgress([{ 
          name: file.name, 
          progress: 100, 
          error: 'Invalid format' 
        }]);
        setIsUploading(false);
        return;
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await axios.post(`${config.API_URL}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress([{ 
              name: file.name, 
              progress: percentCompleted 
            }]);
          }
        });
        
        // Update progress to show completion
        setUploadProgress([{ 
          name: file.name, 
          progress: 100, 
          complete: true 
        }]);
        
        // Notify parent component about successful upload
        onFileUploaded(response.data);
      } catch (error) {
        console.error('Upload failed:', error);
        setUploadProgress([{ 
          name: file.name, 
          progress: 100, 
          error: error.response?.data?.detail || 'Failed to upload file' 
        }]);
      } finally {
        setIsUploading(false);
      }
      return;
    }
    
    // For multiple files, use the new endpoint
    const formData = new FormData();
    
    // Check all files are valid HDF5 files first
    const invalidFiles = files.filter(file => 
      !file.name.endsWith('.h5') && !file.name.endsWith('.hdf5')
    );
    
    if (invalidFiles.length > 0) {
      // Mark invalid files in the progress
      setUploadProgress(prev => {
        const updated = [...prev];
        invalidFiles.forEach(file => {
          const index = files.findIndex(f => f.name === file.name);
          if (index !== -1) {
            updated[index] = { 
              ...updated[index], 
              error: 'Invalid format', 
              progress: 100 
            };
          }
        });
        return updated;
      });
      
      // If all files are invalid, stop here
      if (invalidFiles.length === files.length) {
        setIsUploading(false);
        return;
      }
    }
    
    // Append all valid files
    files.forEach((file, index) => {
      if (file.name.endsWith('.h5') || file.name.endsWith('.hdf5')) {
        formData.append('files', file);
      }
    });
    
    try {
      const response = await axios.post(`${config.API_URL}/upload_multiple`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          // Update all valid files with the same progress
          setUploadProgress(prev => {
            return prev.map((item, i) => {
              // Only update progress for valid files
              if (invalidFiles.findIndex(f => f.name === item.name) === -1) {
                return { ...item, progress: percentCompleted };
              }
              return item;
            });
          });
        }
      });
      
      // Handle the response which has results and errors arrays
      if (response.data.results) {
        // Mark successfully uploaded files as complete
        response.data.results.forEach(result => {
          // Find the file in our progress list by filename
          const index = files.findIndex(file => file.name === result.filename);
          if (index !== -1) {
            setUploadProgress(prev => {
              const updated = [...prev];
              updated[index] = { 
                ...updated[index], 
                complete: true, 
                progress: 100 
              };
              return updated;
            });
            
            // Notify parent component for each successful upload
            onFileUploaded(result);
          }
        });
      }
      
      // Handle any errors
      if (response.data.errors && response.data.errors.length > 0) {
        response.data.errors.forEach(errorMsg => {
          // Extract filename from error message
          const colonIndex = errorMsg.indexOf(':');
          if (colonIndex > -1) {
            const filename = errorMsg.substring(0, colonIndex).trim();
            const errorDetails = errorMsg.substring(colonIndex + 1).trim();
            
            // Find the file in our progress list
            const index = files.findIndex(file => file.name === filename);
            if (index !== -1) {
              setUploadProgress(prev => {
                const updated = [...prev];
                updated[index] = { 
                  ...updated[index], 
                  error: errorDetails, 
                  progress: 100 
                };
                return updated;
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('Multiple file upload failed:', error);
      // Mark all files as failed
      setUploadProgress(prev => 
        prev.map(item => ({
          ...item,
          error: 'Upload failed: ' + (error.response?.data?.detail || error.message || 'Unknown error'),
          progress: 100
        }))
      );
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleUpload(files);
    }
  };
  
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleUpload(files);
    }
  };
  
  const handleButtonClick = () => {
    fileInputRef.current.click();
  };
  
  // Features for the grid
  const features = [
    { icon: '📊', text: 'Product Specifications' },
    { icon: '🎯', text: '2D and 3D Polar Response Analysis' },
    { icon: '📈', text: 'Diffusion and Scattering Coefficients' },
    { icon: '🔷', text: '3D Mesh Visualization' }
  ];
  
  return (
    <>
      <div className="features-grid">
        {features.map((feature, index) => (
          <div className="feature-card" key={index}>
            <span className="feature-icon">{feature.icon}</span>
            <span className="feature-text">{feature.text}</span>
          </div>
        ))}
      </div>
      
      <div className="file-upload">
        <div 
          className={`dropzone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleButtonClick}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            id="file-input"
            accept=".h5,.hdf5" 
            onChange={handleFileChange}
            disabled={isUploading}
            className="file-input"
            multiple
          />
          
          {isUploading ? (
            <div className="upload-status">
              {uploadProgress.map((file, index) => (
                <div key={index} className="file-progress">
                  <p>{file.name} - {file.progress}%</p>
                  <div className="progress-bar">
                    <div 
                      className={`progress-fill ${file.error ? 'error' : file.complete ? 'complete' : ''}`} 
                      style={{ width: `${file.progress}%` }}
                    ></div>
                  </div>
                  {file.error && <p className="upload-error">{file.error}</p>}
                </div>
              ))}
              <p className="drop-text-sub">Processing files, please wait...</p>
            </div>
          ) : (
            <div className="upload-prompt">
              <div className="upload-icon">
                <i className="upload-arrow">⬆️</i>
              </div>
              <p className="drop-text">Visualize Your Acoustic Data</p>
              <p className="drop-text-sub">
                Drag and drop your HDF5 files to analyze diffusion coefficients, visualize 3D models, and more
              </p>
              <div className="or-text">or</div>
              <button className="browse-button">Select HDF5 Files</button>
              <div className="file-hint">.h5, .hdf5 files (multiple files allowed)</div>
            </div>
          )}
        </div>
        
        {error && <p className="error-message">{error}</p>}
      </div>
    </>
  );
};

export default FileUpload; 