import React, { useState, useEffect, useRef, useMemo } from 'react';
import { saveFile, getFiles, deleteFile } from '../utils/FileDB';
import './FileManager.css';

const FileManager = ({ tasks, targetTask }) => {
  const [currentPath, setCurrentPath] = useState([{ id: 'root', name: 'الرئيسية' }]);
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const currentFolder = currentPath[currentPath.length - 1];

  // Derive folders dynamically based on current path
  const getSubFolders = () => {
    if (currentFolder.id === 'root') {
      return [{ id: 'tasks_root', name: 'الفقرات (المهام)' }];
    }

    if (currentFolder.id === 'tasks_root') {
      // Return top-level tasks (no dots in WBS)
      return tasks
        .filter(t => t.wbs && !t.wbs.includes('.'))
        .map(t => ({ id: `task_${t.id}`, name: `${t.wbs} - ${t.name}`, taskRef: t }));
    }

    if (currentFolder.id.startsWith('task_')) {
      // Subtasks no longer have folders, only files
      return [];
    }

    return [];
  };

  const folders = getSubFolders();

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const folderFiles = await getFiles(currentFolder.id);
      setFiles(folderFiles);
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch files whenever the active folder changes. This is async data
  // fetching from IndexedDB — setState happens after `await` (in the resolved
  // promise callback), which is the documented safe pattern for effects that
  // pull from an external system.
  useEffect(() => {
    let ignore = false;
    (async () => {
      setIsLoading(true);
      try {
        const folderFiles = await getFiles(currentFolder.id);
        if (!ignore) setFiles(folderFiles);
      } catch (err) {
        console.error('Failed to load files:', err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [currentFolder.id]);

  // Derived folder path for the externally-requested target task.
  // Computed during render (pure function of props) so we never setState
  // synchronously inside an effect.
  const targetPath = useMemo(() => {
    if (!targetTask) return null;
    const path = [
      { id: 'root', name: 'الرئيسية' },
      { id: 'tasks_root', name: 'الفقرات (المهام)' }
    ];
    if (targetTask.wbs) {
      // Only build path to the main task (top level)
      const mainWbs = targetTask.wbs.split('.')[0];
      const mainTask = tasks.find(t => t.wbs === mainWbs);
      if (mainTask) {
        path.push({ id: `task_${mainTask.id}`, name: `${mainTask.wbs} - ${mainTask.name}` });
      }
    }
    return path;
  }, [targetTask, tasks]);

  // Track the last target path we navigated to, so we only navigate when it
  // actually changes (avoids redundant state updates / cascading renders).
  const lastTargetPathRef = useRef(null);

  useEffect(() => {
    if (targetPath && targetPath !== lastTargetPathRef.current) {
      lastTargetPathRef.current = targetPath;
      setCurrentPath(targetPath);
    }
  }, [targetPath]);

  const handleNavigate = (folder) => {
    setCurrentPath([...currentPath, folder]);
  };

  const handleBreadcrumbClick = (index) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };

  const handleFileUpload = async (event) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsLoading(true);
    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        await saveFile(currentFolder.id, uploadedFiles[i]);
      }
      await loadFiles();
    } catch (err) {
      console.error('Upload failed:', err);
      alert('فشل في رفع الملف');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const uploadedFiles = e.dataTransfer.files;
      setIsLoading(true);
      try {
        for (let i = 0; i < uploadedFiles.length; i++) {
          await saveFile(currentFolder.id, uploadedFiles[i]);
        }
        await loadFiles();
      } catch (err) {
        console.error('Upload failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الملف؟')) {
      try {
        await deleteFile(fileId);
        await loadFiles();
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
  };

  const handleDownloadFile = (file) => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fm-container">
      <div className="fm-header">
        <div className="fm-breadcrumbs">
          {currentPath.map((folder, index) => (
            <React.Fragment key={folder.id}>
              <span 
                className={`fm-crumb ${index === currentPath.length - 1 ? 'active' : ''}`}
                onClick={() => handleBreadcrumbClick(index)}
              >
                {folder.name}
              </span>
              {index < currentPath.length - 1 && <span className="fm-crumb-sep">/</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="fm-actions">
          <input 
            type="file" 
            multiple 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />
          <button className="fm-upload-btn" onClick={() => fileInputRef.current?.click()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            رفع ملف
          </button>
        </div>
      </div>

      <div 
        className={`fm-dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
      >
        {isLoading && <div className="fm-loading-overlay"><div className="fm-spinner"></div></div>}
        
        {folders.length === 0 && files.length === 0 && !isLoading && (
          <div className="fm-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
            <p>المجلد فارغ</p>
            <p className="fm-empty-sub">قم بسحب وإفلات الملفات هنا أو اضغط على "رفع ملف"</p>
          </div>
        )}

        {(folders.length > 0 || files.length > 0) && (
          <div className="fm-grid">
            {folders.map(folder => (
              <div key={folder.id} className="fm-item fm-folder" onClick={() => handleNavigate(folder)}>
                <div className="fm-icon">
                  <svg viewBox="0 0 24 24" fill="var(--apple-blue)" stroke="none">
                    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                  </svg>
                </div>
                <div className="fm-item-name" title={folder.name}>{folder.name}</div>
              </div>
            ))}

            {files.map(file => (
              <div key={file.id} className="fm-item fm-file" title={file.name}>
                <div className="fm-icon" onClick={() => handleDownloadFile(file)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                </div>
                <div className="fm-item-details">
                  <div className="fm-item-name" onClick={() => handleDownloadFile(file)}>{file.name}</div>
                  <div className="fm-item-meta">{formatSize(file.size)}</div>
                </div>
                <button className="fm-delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }} title="حذف الملف">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileManager;
