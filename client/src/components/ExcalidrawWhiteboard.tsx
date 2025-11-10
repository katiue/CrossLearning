import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from "react";
import { Excalidraw, MainMenu, exportToBlob } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { axiosClient } from "@/helper/axiosClient";
import { toast } from "react-toastify";

interface ExcalidrawWhiteboardProps {
  sessionId: string;
  sessionType?: 'teach' | 'peer'; // Specify session type for API endpoints
  onWhiteboardChange?: (elements: any[], appState: any) => void; // Real-time broadcast callback
  onRemoteUpdate?: (handler: (data: { elements: any[], app_state: any }) => void) => void; // Register remote update handler
}

export interface WhiteboardHandle {
  addImageToCanvas: (imageUrl: string, fileName?: string) => Promise<void>;
  addMultipleFilesToCanvas: (files: Array<{ url: string; fileName?: string }>) => Promise<void>;
  exportAsImage: () => Promise<Blob | null>;
}

const ExcalidrawWhiteboard = forwardRef<WhiteboardHandle, ExcalidrawWhiteboardProps>(
  ({ sessionId, sessionType = 'teach', onWhiteboardChange, onRemoteUpdate }, ref) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isApplyingRemoteUpdate = useRef(false); // Prevent feedback loop

  // Determine base URL based on session type
  const baseUrl = sessionType === 'peer' 
    ? `/peer-learning/sessions/${sessionId}` 
    : `/teach-sessions/sessions/${sessionId}`;

  // Load whiteboard data on mount
  useEffect(() => {
    loadWhiteboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Register remote update handler (for peer learning real-time sync)
  useEffect(() => {
    if (!onRemoteUpdate || !excalidrawAPI) return;

    const handleRemoteUpdate = (data: { elements: any[], app_state: any }) => {
      if (isApplyingRemoteUpdate.current) return; // Prevent feedback loop

      isApplyingRemoteUpdate.current = true;
      
      try {
        excalidrawAPI.updateScene({
          elements: data.elements || [],
          appState: data.app_state || {},
        });
        console.log('Applied remote whiteboard update');
      } catch (error) {
        console.error('Failed to apply remote whiteboard update:', error);
      } finally {
        setTimeout(() => {
          isApplyingRemoteUpdate.current = false;
        }, 100);
      }
    };

    onRemoteUpdate(handleRemoteUpdate);
  }, [onRemoteUpdate, excalidrawAPI]);

  // Broadcast whiteboard changes (for peer learning real-time sync)
  useEffect(() => {
    if (!excalidrawAPI || !onWhiteboardChange || sessionType !== 'peer') {
      console.log('⏸️ Whiteboard broadcast disabled:', { 
        hasAPI: !!excalidrawAPI, 
        hasCallback: !!onWhiteboardChange, 
        sessionType 
      });
      return;
    }

    console.log('✅ Whiteboard broadcast enabled for peer learning');

    let timeoutId: NodeJS.Timeout;
    let lastElementsHash = '';

    const handleChange = () => {
      if (isApplyingRemoteUpdate.current) {
        console.log('⏭️ Skipping broadcast (applying remote update)');
        return;
      }

      // Debounce to prevent too many updates
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        
        // Create a simple hash to detect actual changes
        const currentHash = JSON.stringify(elements.map((e: any) => e.id + e.version));
        
        if (currentHash !== lastElementsHash) {
          lastElementsHash = currentHash;
          console.log('📡 Broadcasting whiteboard update:', elements.length, 'elements');
          
          onWhiteboardChange(elements, {
            viewBackgroundColor: appState.viewBackgroundColor,
            currentItemStrokeColor: appState.currentItemStrokeColor,
            currentItemBackgroundColor: appState.currentItemBackgroundColor,
            currentItemFillStyle: appState.currentItemFillStyle,
            currentItemStrokeWidth: appState.currentItemStrokeWidth,
            currentItemRoughness: appState.currentItemRoughness,
            currentItemOpacity: appState.currentItemOpacity,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            zoom: appState.zoom,
          });
        }
      }, 500); // 500ms debounce
    };

    // Listen for changes - check every second
    const observer = setInterval(handleChange, 1000);

    return () => {
      clearInterval(observer);
      clearTimeout(timeoutId);
    };
  }, [excalidrawAPI, onWhiteboardChange, sessionType]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!excalidrawAPI) return;

    const autoSaveInterval = setInterval(() => {
      saveWhiteboardData();
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excalidrawAPI]);

  const loadWhiteboardData = async () => {
    try {
      const response = await axiosClient.get(`${baseUrl}/whiteboard`);
      
      // Check if we have whiteboard data
      if (response.data && response.data.length > 0) {
        const latestWhiteboard = response.data[0]; // Get the most recent whiteboard data
        
        if (latestWhiteboard.drawing_data) {
          const { elements, appState } = latestWhiteboard.drawing_data;
          
          // Wait for API to be ready
          setTimeout(() => {
            if (excalidrawAPI) {
              excalidrawAPI.updateScene({
                elements: elements || [],
                appState: appState || {},
              });
            }
          }, 100);
        }
      }
    } catch (error: any) {
      // If no whiteboard data exists yet, that's okay
      if (error.response?.status !== 404) {
        console.error("Failed to load whiteboard:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveWhiteboardData = useCallback(async () => {
    if (!excalidrawAPI) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();

      // Combine elements and appState into drawing_data as expected by backend
      const drawingData = {
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          currentItemStrokeColor: appState.currentItemStrokeColor,
          currentItemBackgroundColor: appState.currentItemBackgroundColor,
          currentItemFillStyle: appState.currentItemFillStyle,
          currentItemStrokeWidth: appState.currentItemStrokeWidth,
          currentItemRoughness: appState.currentItemRoughness,
          currentItemOpacity: appState.currentItemOpacity,
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom,
        },
      };

      await axiosClient.post(`${baseUrl}/whiteboard`, {
        drawing_data: drawingData,
      });

      console.log("Whiteboard auto-saved");
    } catch (error: any) {
      console.error("Failed to save whiteboard:", error.response?.data || error);
    }
  }, [excalidrawAPI, sessionId, baseUrl]);

  const handleExcalidrawAPI = (api: any) => {
    setExcalidrawAPI(api);
  };

  // Expose method to add images to canvas via ref
  useImperativeHandle(ref, () => ({
    addImageToCanvas: async (imageUrl: string, fileName?: string) => {
      if (!excalidrawAPI) {
        toast.error("Whiteboard not ready yet");
        return;
      }

      await addFileToCanvas(imageUrl, fileName);
    },
    addMultipleFilesToCanvas: async (files: Array<{ url: string; fileName?: string }>) => {
      if (!excalidrawAPI) {
        console.warn("Whiteboard not ready yet, files will not be auto-loaded");
        return;
      }

      // Add files one by one with a small delay to avoid overwhelming the canvas
      for (const file of files) {
        await addFileToCanvas(file.url, file.fileName);
        // Small delay between additions
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (files.length > 0) {
        toast.success(`${files.length} file(s) loaded to whiteboard`);
      }
    },
    exportAsImage: async () => {
      if (!excalidrawAPI) {
        console.error("Whiteboard API not ready");
        return null;
      }

      try {
        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles();

        // Export to blob using the imported exportToBlob function
        const blob = await exportToBlob({
          elements,
          appState,
          files,
          mimeType: "image/png",
          quality: 0.8,
          exportPadding: 20,
        });

        return blob;
      } catch (error) {
        console.error("Failed to export whiteboard:", error);
        return null;
      }
    }
  }));

  const addFileToCanvas = async (imageUrl: string, fileName?: string) => {
    if (!excalidrawAPI) {
      return;
    }

    try {
        // Check if it's a PDF
        const isPDF = imageUrl.includes('.pdf') || imageUrl.toLowerCase().includes('pdf');
        
        if (isPDF) {
          // Convert PDF to image using Cloudinary transformation
          // Replace /upload/ with /upload/f_png,pg_1/ to get first page as PNG
          let pdfAsImageUrl = imageUrl;
          
          if (imageUrl.includes('cloudinary.com')) {
            // For Cloudinary URLs, use transformation to convert PDF to image
            pdfAsImageUrl = imageUrl.replace('/upload/', '/upload/f_png,pg_1/');
            
            toast.info("Converting PDF to image...");
            
            // Now try to load it as an image
            try {
              const response = await fetch(pdfAsImageUrl);
              const blob = await response.blob();
              
              const reader = new FileReader();
              reader.onloadend = () => {
                const dataURL = reader.result as string;
                const fileId = `file_${Date.now()}`;
                
                const img = new Image();
                img.onload = () => {
                  // Register the file
                  const files = [{
                    id: fileId,
                    dataURL: dataURL,
                    mimeType: "image/png",
                    created: Date.now(),
                  }];
                  
                  excalidrawAPI.addFiles(files);
                  
                  // Calculate scaled dimensions
                  const maxWidth = 800;
                  const maxHeight = 1000;
                  let width = img.width;
                  let height = img.height;
                  
                  if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                  }
                  
                  // Create image element
                  const imageElement = {
                    type: "image",
                    version: 1,
                    versionNonce: Math.floor(Math.random() * 1000000),
                    isDeleted: false,
                    id: `image_${Date.now()}`,
                    fillStyle: "solid",
                    strokeWidth: 0,
                    strokeStyle: "solid",
                    roughness: 0,
                    opacity: 100,
                    angle: 0,
                    x: 100 + Math.random() * 100,
                    y: 100 + Math.random() * 100,
                    strokeColor: "transparent",
                    backgroundColor: "transparent",
                    width: width,
                    height: height,
                    seed: Math.floor(Math.random() * 1000000),
                    groupIds: [],
                    frameId: null,
                    roundness: null,
                    boundElements: [],
                    updated: Date.now(),
                    link: imageUrl, // Keep original PDF link
                    locked: false,
                    status: "saved",
                    fileId: fileId,
                    scale: [1, 1],
                  };
                  
                  const currentElements = excalidrawAPI.getSceneElements();
                  excalidrawAPI.updateScene({
                    elements: [...currentElements, imageElement],
                  });
                  
                  toast.success(`PDF (page 1) added to whiteboard! Click to view full PDF`);
                };
                
                img.onerror = () => {
                  // If conversion fails, create a link box
                  createPDFLinkBox(imageUrl, fileName, excalidrawAPI);
                };
                
                img.src = dataURL;
              };
              
              reader.readAsDataURL(blob);
            } catch (error) {
              // If fetching fails, create a link box
              createPDFLinkBox(imageUrl, fileName, excalidrawAPI);
            }
          } else {
            // For non-Cloudinary PDFs, create a link box
            createPDFLinkBox(imageUrl, fileName, excalidrawAPI);
          }
          
          return; // Exit early for PDFs
        }
        
        // Check for other document types
        const isDoc = imageUrl.includes('.doc') || imageUrl.includes('.docx') || 
                     imageUrl.includes('.txt') || imageUrl.includes('.ppt');
        
        if (isDoc) {
          const fileType = imageUrl.includes('.doc') ? 'Word Document' :
                          imageUrl.includes('.ppt') ? 'Presentation' :
                          imageUrl.includes('.txt') ? 'Text File' :
                          'Document';
          
          createDocumentLinkBox(imageUrl, fileName, fileType, excalidrawAPI);
          return;
        }
        
        // Only if it's not a PDF/doc, try to load as image
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataURL = reader.result as string;
          const fileId = `file_${Date.now()}`;
          
          const img = new Image();
          img.onload = () => {
            const files = [{
              id: fileId,
              dataURL: dataURL,
              mimeType: blob.type || "image/png",
              created: Date.now(),
            }];
            
            excalidrawAPI.addFiles(files);
            
            const maxWidth = 600;
            const maxHeight = 400;
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = width * ratio;
              height = height * ratio;
            }
            
            const imageElement = {
              type: "image",
              version: 1,
              versionNonce: Math.floor(Math.random() * 1000000),
              isDeleted: false,
              id: `image_${Date.now()}`,
              fillStyle: "solid",
              strokeWidth: 0,
              strokeStyle: "solid",
              roughness: 0,
              opacity: 100,
              angle: 0,
              x: 100 + Math.random() * 100,
              y: 100 + Math.random() * 100,
              strokeColor: "transparent",
              backgroundColor: "transparent",
              width: width,
              height: height,
              seed: Math.floor(Math.random() * 1000000),
              groupIds: [],
              frameId: null,
              roundness: null,
              boundElements: [],
              updated: Date.now(),
              link: null,
              locked: false,
              status: "saved",
              fileId: fileId,
              scale: [1, 1],
            };
            
            const currentElements = excalidrawAPI.getSceneElements();
            excalidrawAPI.updateScene({
              elements: [...currentElements, imageElement],
            });
            
            toast.success(`${fileName || "Image"} added to whiteboard!`);
          };
          
          img.onerror = () => {
            toast.error("Failed to load image - file may not be a valid image format");
          };
          
          img.src = dataURL;
        };
        
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error("Error adding to canvas:", error);
        toast.error("Failed to add file to whiteboard");
      }
  };

  // Helper function to create PDF link box
  const createPDFLinkBox = (imageUrl: string, fileName: string | undefined, excalidrawAPI: any) => {
    const textElement = {
      type: "text",
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      id: `text_${Date.now()}`,
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      x: 100 + Math.random() * 100,
      y: 100 + Math.random() * 100,
      strokeColor: "#c92a2a",
      backgroundColor: "#ffe3e3",
      width: 320,
      height: 100,
      seed: Math.floor(Math.random() * 1000000),
      groupIds: [],
      frameId: null,
      roundness: { type: 3 },
      boundElements: [],
      updated: Date.now(),
      link: imageUrl,
      locked: false,
      fontSize: 16,
      fontFamily: 1,
      text: `📄 PDF\n${fileName || "Document"}\n\n🔗 Click to open`,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: null,
      originalText: `📄 PDF\n${fileName || "Document"}\n\n🔗 Click to open`,
      lineHeight: 1.25,
    };

    const currentElements = excalidrawAPI.getSceneElements();
    excalidrawAPI.updateScene({
      elements: [...currentElements, textElement],
    });

    toast.info("PDF reference added - click to open");
  };

  // Helper function to create document link box
  const createDocumentLinkBox = (imageUrl: string, fileName: string | undefined, fileType: string, excalidrawAPI: any) => {
    const textElement = {
      type: "text",
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      id: `text_${Date.now()}`,
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      x: 100 + Math.random() * 100,
      y: 100 + Math.random() * 100,
      strokeColor: "#1971c2",
      backgroundColor: "#e7f5ff",
      width: 320,
      height: 100,
      seed: Math.floor(Math.random() * 1000000),
      groupIds: [],
      frameId: null,
      roundness: { type: 3 },
      boundElements: [],
      updated: Date.now(),
      link: imageUrl,
      locked: false,
      fontSize: 16,
      fontFamily: 1,
      text: `📄 ${fileType}\n${fileName || "Document"}\n\n🔗 Click to open`,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: null,
      originalText: `📄 ${fileType}\n${fileName || "Document"}\n\n🔗 Click to open`,
      lineHeight: 1.25,
    };

    const currentElements = excalidrawAPI.getSceneElements();
    excalidrawAPI.updateScene({
      elements: [...currentElements, textElement],
    });

    toast.info(`${fileType} reference added - click to open`);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">Loading whiteboard...</p>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <Excalidraw
        excalidrawAPI={handleExcalidrawAPI}
        theme="light"
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: {
              saveFileToDisk: true,
            },
            saveToActiveFile: false,
          },
          welcomeScreen: false,
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
      </Excalidraw>
    </div>
  );
});

ExcalidrawWhiteboard.displayName = "ExcalidrawWhiteboard";

export default ExcalidrawWhiteboard;
