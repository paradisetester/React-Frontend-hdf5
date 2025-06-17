import React from 'react';
import './FileManager.css';

const FileManager = ({ 
  files, 
  selectedFileIds, 
  onFileSelect, 
  onFileDelete, 
  onComparisonToggle, 
  onUploadNew 
}) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateFilename = (filename, maxLength = 20) => {
    if (filename.length <= maxLength) return filename;
    
    const ext = filename.slice(filename.lastIndexOf('.'));
    const name = filename.slice(0, filename.lastIndexOf('.'));
    
    return `${name.slice(0, maxLength - ext.length - 3)}...${ext}`;
  };

  const getFileExtension = (filename) => {
    return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  };

  const getFileTypeIcon = (filename) => {
    const ext = getFileExtension(filename);
    const iconMap = {
      'pdf': 'file-text',
      'doc': 'file-text',
      'docx': 'file-text',
      'txt': 'file-text',
      'csv': 'file-spreadsheet',
      'xlsx': 'file-spreadsheet',
      'xls': 'file-spreadsheet',
      'json': 'file-code',
      'xml': 'file-code',
      'html': 'file-code',
      'default': 'file'
    };
    
    return iconMap[ext] || iconMap['default'];
  };

  const handleFileClick = (fileId) => {
    // Toggle file selection when clicking on the file
    onComparisonToggle(fileId);
  };

  return (
    <div className="file-manager">
      <div className="file-manager-header">
        <div className="header-content">
          <h3>File Library</h3>
          <div className="file-count">
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </div>
        </div>
        <button className="upload-button" onClick={onUploadNew} aria-label="Upload new file">
          {/* <span className="upload-icon">+</span> */}
          Add File
        </button>
      </div>
      
      {files.length === 0 ? (
        <div className="no-files">
          <div className="no-files-icon"></div>
          <p>No files uploaded yet</p>
          <span className="no-files-subtitle">Upload your first file to get started</span>
        </div>
      ) : (
        <>
          <div className="file-list-container">
            <ul className="file-list">
              {files.map(file => {
                const isSelected = selectedFileIds.includes(file.file_id);
                return (
                  <li 
                    key={file.file_id} 
                    className={`file-item ${isSelected ? 'selected' : ''}`}
                  >
                    <div 
                      className="file-content" 
                      onClick={() => handleFileClick(file.file_id)}
                    >
                      <div className="file-icon-container">
                        <div className={`file-icon ${getFileTypeIcon(file.filename)}`}></div>
                        {isSelected && <div className="selection-indicator"></div>}
                      </div>
                      
                      <div className="file-details">
                        <div className="file-name" title={file.filename}>
                          {truncateFilename(file.filename)}
                        </div>
                        <div className="file-meta">
                          <span className="file-date">{formatDate(file.upload_time)}</span>
                          <span className="file-size">{getFileExtension(file.filename).toUpperCase()}</span>
                        </div>
                      </div>
                      
                      <div className="selection-status">
                        <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
                          {isSelected && <div className="checkmark"></div>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="file-actions">
                      <button 
                        className="action-button delete-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFileDelete(file.file_id);
                        }}
                        title="Delete file"
                        aria-label="Delete file"
                      >
                        <div className="delete-icon"></div>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          
          <div className="comparison-panel">
            <div className="comparison-header">
              <h4>Comparison Selection</h4>
              <div className="selection-count">
                {selectedFileIds.length} selected
              </div>
            </div>
            
            {selectedFileIds.length === 0 ? (
              <p className="comparison-hint">Select files to compare them</p>
            ) : selectedFileIds.length === 1 ? (
              <p className="comparison-hint">Select one more file to compare</p>
            ) : (
              <div className="comparison-files">
                {selectedFileIds.map(id => {
                  const file = files.find(f => f.file_id === id);
                  return file ? (
                    <div key={id} className="comparison-file-badge" title={file.filename}>
                      <div className="badge-icon"></div>
                      <span>{truncateFilename(file.filename, 15)}</span>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FileManager; 