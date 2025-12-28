import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Plus, Trash2, Move, Download, Code, ChevronDown, ChevronUp, Pencil, Edit, Eye, EyeOff } from 'lucide-react';

const VectorMorphTool = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const curveCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  
  const [shapes, setShapes] = useState<any[]>([]);
  const [currentShape, setCurrentShape] = useState({
    points: [] as any[],
    iterations: 30,
    rotation: 5,
    scale: 0.97,
    opacity: 0.8,
    color: '#000000',
    startWidth: 2,
    endWidth: 0.5,
    displacementAmount: 0,
    iterationDistortion: 0,
    uniformity: 0.5,
    isClosed: false
  });
  
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [morphDuration, setMorphDuration] = useState(3);
  const [easingCurve, setEasingCurve] = useState('easeInOut');
  const [tool, setTool] = useState('pen');
  const [isDraggingNewPoint, setIsDraggingNewPoint] = useState(false);
  const [newPointIndex, setNewPointIndex] = useState<number | null>(null);
  const [isHoveringFirstPoint, setIsHoveringFirstPoint] = useState(false);
  const [customCurve, setCustomCurve] = useState<Array<{
    x: number;
    y: number;
    handleOut?: { x: number; y: number };
    handleIn?: { x: number; y: number };
  }>>([
    { x: 0, y: 0, handleOut: { x: 0.25, y: 0.25 } },
    { x: 1, y: 1, handleIn: { x: 0.75, y: 0.75 } }
  ]);
  const [isDraggingCurvePoint, setIsDraggingCurvePoint] = useState<number | null>(null);
  const [draggingCurveHandle, setDraggingCurveHandle] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isDraggingInSelect, setIsDraggingInSelect] = useState(false);
  const [showSavedShapesOnCanvas, setShowSavedShapesOnCanvas] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [lastBackgroundColor, setLastBackgroundColor] = useState('#ffffff');
  const [showCopyNotification, setShowCopyNotification] = useState(false);
  const [draggedShapeIndex, setDraggedShapeIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [shapeVisibility, setShapeVisibility] = useState<boolean[]>([]);
  
  // Dropdown states
  const [showIterationParams, setShowIterationParams] = useState(true);
  const [showStrokeParams, setShowStrokeParams] = useState(false);
  const [showAnimationParams, setShowAnimationParams] = useState(false);
  const [showCanvasParams, setShowCanvasParams] = useState(false);
  
  // Canvas settings
  const [aspectRatio, setAspectRatio] = useState('16:10'); // Default 800x500
  
  const easingFunctions: { [key: string]: (t: number) => number } = {
    linear: t => t,
    easeIn: t => t * t,
    easeOut: t => t * (2 - t),
    easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    bounce: t => {
      if (t < 0.5) return 8 * t * t * t * t;
      const f = t - 1;
      return 1 + 8 * f * f * f * f;
    },
    custom: t => {
      if (customCurve.length !== 2) return t;
      
      const p0 = customCurve[0];
      const p1 = customCurve[1];
      
      // Cubic bezier interpolation
      const cp1x = p0.handleOut?.x ?? p0.x;
      const cp1y = p0.handleOut?.y ?? p0.y;
      const cp2x = p1.handleIn?.x ?? p1.x;
      const cp2y = p1.handleIn?.y ?? p1.y;
      
      // Binary search to find t value that gives us the input x
      let tMin = 0, tMax = 1;
      let currentT = t;
      
      for (let iter = 0; iter < 10; iter++) {
        const bezierX = Math.pow(1 - currentT, 3) * p0.x +
                       3 * Math.pow(1 - currentT, 2) * currentT * cp1x +
                       3 * (1 - currentT) * Math.pow(currentT, 2) * cp2x +
                       Math.pow(currentT, 3) * p1.x;
        
        if (Math.abs(bezierX - t) < 0.001) break;
        
        if (bezierX < t) {
          tMin = currentT;
        } else {
          tMax = currentT;
        }
        currentT = (tMin + tMax) / 2;
      }
      
      // Calculate y using the found t
      const bezierY = Math.pow(1 - currentT, 3) * p0.y +
                     3 * Math.pow(1 - currentT, 2) * currentT * cp1y +
                     3 * (1 - currentT) * Math.pow(currentT, 2) * cp2y +
                     Math.pow(currentT, 3) * p1.y;
      
      return bezierY;
    }
  };
  
  const distance = (p1: any, p2: any) => {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  };
  
  const saveToHistory = (newPoints: any[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newPoints]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };
  
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCurrentShape(prev => ({
        ...prev,
        points: [...history[historyIndex - 1]]
      }));
    }
  };
  
  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCurrentShape(prev => ({
        ...prev,
        points: [...history[historyIndex + 1]]
      }));
    }
  };
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      
      if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        redo();
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);
  
  const drawCurveEditor = () => {
    const canvas = curveCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 10;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    
    ctx.fillStyle = '#fafafa'; // #fafafa
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#e4e4e7'; // #f5f5f5 for grid lines
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = padding + (graphWidth / 4) * i;
      const y = padding + (graphHeight / 4) * i;
      
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Draw Bezier curve - use current shape color
    const rgb = hexToRgb(currentShape.color);
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const toCanvasX = (x: number) => padding + x * graphWidth;
    const toCanvasY = (y: number) => height - padding - y * graphHeight;
    
    const p0 = customCurve[0];
    const p1 = customCurve[1];
    
    const cp1x = toCanvasX(p0.handleOut?.x ?? p0.x);
    const cp1y = toCanvasY(p0.handleOut?.y ?? p0.y);
    const cp2x = toCanvasX(p1.handleIn?.x ?? p1.x);
    const cp2y = toCanvasY(p1.handleIn?.y ?? p1.y);
    
    ctx.moveTo(toCanvasX(p0.x), toCanvasY(p0.y));
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, toCanvasX(p1.x), toCanvasY(p1.y));
    ctx.stroke();
    
    // Draw handles and lines - use lighter version of shape color
    const handleRgb = { r: Math.min(255, rgb.r + 60), g: Math.min(255, rgb.g + 60), b: Math.min(255, rgb.b + 60) };
    ctx.strokeStyle = `rgba(${handleRgb.r}, ${handleRgb.g}, ${handleRgb.b}, 0.5)`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    // Draw first point's handleOut
    const p0x = toCanvasX(customCurve[0].x);
    const p0y = toCanvasY(customCurve[0].y);
    if (customCurve[0].handleOut) {
      const h1x = toCanvasX(customCurve[0].handleOut.x);
      const h1y = toCanvasY(customCurve[0].handleOut.y);
      
      ctx.beginPath();
      ctx.moveTo(p0x, p0y);
      ctx.lineTo(h1x, h1y);
      ctx.stroke();
      
      ctx.fillStyle = `rgba(${handleRgb.r}, ${handleRgb.g}, ${handleRgb.b}, 0.8)`;
      ctx.beginPath();
      ctx.arc(h1x, h1y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw second point's handleIn
    const p1x = toCanvasX(customCurve[1].x);
    const p1y = toCanvasY(customCurve[1].y);
    if (customCurve[1].handleIn) {
      const h2x = toCanvasX(customCurve[1].handleIn.x);
      const h2y = toCanvasY(customCurve[1].handleIn.y);
      
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(h2x, h2y);
      ctx.stroke();
      
      ctx.fillStyle = `rgba(${handleRgb.r}, ${handleRgb.g}, ${handleRgb.b}, 0.8)`;
      ctx.beginPath();
      ctx.arc(h2x, h2y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.setLineDash([]);
    
    // Draw control points (start and end) - use shape color
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`;
    
    // Start point
    ctx.beginPath();
    ctx.arc(p0x, p0y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p0x, p0y, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // End point
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`;
    ctx.beginPath();
    ctx.arc(p1x, p1y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p1x, p1y, 3, 0, Math.PI * 2);
    ctx.fill();
  };
  
  const handleCurveMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = curveCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    // Scale mouse coordinates from display size to canvas internal resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const padding = 10;
    const graphWidth = canvas.width - padding * 2;
    const graphHeight = canvas.height - padding * 2;
    
    const toCanvasX = (x: number) => padding + x * graphWidth;
    const toCanvasY = (y: number) => canvas.height - padding - y * graphHeight;
    
    // Check handleOut of first point
    if (customCurve[0].handleOut) {
      const hx = toCanvasX(customCurve[0].handleOut.x);
      const hy = toCanvasY(customCurve[0].handleOut.y);
      if (distance({ x, y }, { x: hx, y: hy }) < 10) {
        setIsDraggingCurvePoint(0);
        setDraggingCurveHandle('handleOut');
        return;
      }
    }
    
    // Check handleIn of second point
    if (customCurve[1].handleIn) {
      const hx = toCanvasX(customCurve[1].handleIn.x);
      const hy = toCanvasY(customCurve[1].handleIn.y);
      if (distance({ x, y }, { x: hx, y: hy }) < 10) {
        setIsDraggingCurvePoint(1);
        setDraggingCurveHandle('handleIn');
        return;
      }
    }
    
    // Check start point
    const p0x = toCanvasX(customCurve[0].x);
    const p0y = toCanvasY(customCurve[0].y);
    if (distance({ x, y }, { x: p0x, y: p0y }) < 10) {
      setIsDraggingCurvePoint(0);
      setDraggingCurveHandle(null);
      return;
    }
    
    // Check end point
    const p1x = toCanvasX(customCurve[1].x);
    const p1y = toCanvasY(customCurve[1].y);
    if (distance({ x, y }, { x: p1x, y: p1y }) < 10) {
      setIsDraggingCurvePoint(1);
      setDraggingCurveHandle(null);
    }
  };
  
  const handleCurveMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingCurvePoint === null) return;
    
    const canvas = curveCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    // Scale mouse coordinates from display size to canvas internal resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const padding = 10;
    const graphWidth = canvas.width - padding * 2;
    const graphHeight = canvas.height - padding * 2;
    
    let normX = (x - padding) / graphWidth;
    let normY = (canvas.height - padding - y) / graphHeight;
    
    normX = Math.max(0, Math.min(1, normX));
    normY = Math.max(0, Math.min(1, normY));
    
    const newCurve = [...customCurve];
    
    if (draggingCurveHandle === 'handleOut') {
      // Dragging handleOut
      newCurve[isDraggingCurvePoint] = {
        ...newCurve[isDraggingCurvePoint],
        handleOut: { x: normX, y: normY }
      };
    } else if (draggingCurveHandle === 'handleIn') {
      // Dragging handleIn
      newCurve[isDraggingCurvePoint] = {
        ...newCurve[isDraggingCurvePoint],
        handleIn: { x: normX, y: normY }
      };
    } else {
      // Dragging control point - keep them locked to corners
      normX = isDraggingCurvePoint === 0 ? 0 : 1;
      normY = isDraggingCurvePoint === 0 ? 0 : 1;
      
      const oldPoint = newCurve[isDraggingCurvePoint];
      const dx = normX - oldPoint.x;
      const dy = normY - oldPoint.y;
      
      // Move handles with the point
      newCurve[isDraggingCurvePoint] = {
        ...oldPoint,
        x: normX,
        y: normY,
        handleIn: oldPoint.handleIn ? { x: oldPoint.handleIn.x + dx, y: oldPoint.handleIn.y + dy } : oldPoint.handleIn,
        handleOut: oldPoint.handleOut ? { x: oldPoint.handleOut.x + dx, y: oldPoint.handleOut.y + dy } : oldPoint.handleOut
      };
    }
    
    setCustomCurve(newCurve);
  };
  
  const handleCurveMouseUp = () => {
    setIsDraggingCurvePoint(null);
    setDraggingCurveHandle(null);
  };
  
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const dimensions = getCanvasDimensions();
    const aspectRatio = dimensions.width / dimensions.height;
    
    // Calculate the actual displayed canvas area (accounting for object-contain)
    let displayWidth = rect.width;
    let displayHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;
    
    // If canvas is letterboxed (width constrained)
    if (rect.width / rect.height > aspectRatio) {
      displayWidth = rect.height * aspectRatio;
      offsetX = (rect.width - displayWidth) / 2;
    } else {
      // If canvas is pillarboxed (height constrained)
      displayHeight = rect.width / aspectRatio;
      offsetY = (rect.height - displayHeight) / 2;
    }
    
    // Mouse coordinates in the logical coordinate system
    const x = ((e.clientX - rect.left - offsetX) / displayWidth) * dimensions.width;
    const y = ((e.clientY - rect.top - offsetY) / displayHeight) * dimensions.height;
    
    if (tool === 'pen') {
      // Check if clicking near the first point to close the shape
      if (currentShape.points.length >= 3 && !currentShape.isClosed) {
        const firstPoint = currentShape.points[0];
        const distToFirst = distance({ x, y }, firstPoint);
        
        // If within 30 pixels of first point, close the shape
        if (distToFirst < 30) {
          setCurrentShape(prev => ({
            ...prev,
            isClosed: true
          }));
          saveToHistory(currentShape.points);
          return;
        }
      }
      
      // Create new point with curve handles
      const newPoint = {
        x,
        y,
        handleIn: { x: x - 30, y },
        handleOut: { x: x + 30, y }
      };
      
      const newIndex = currentShape.points.length;
      const newPoints = [...currentShape.points, newPoint];
      
      // If shape was closed, reopen it when adding a new point
      setCurrentShape(prev => ({
        ...prev,
        points: newPoints,
        isClosed: false // Reopen shape when adding new points
      }));
      setSelectedPoint(newIndex);
      setIsDraggingNewPoint(true);
      setNewPointIndex(newIndex);
      
      // Don't save to history here - wait for mouseUp after dragging the handle
    } else if (tool === 'select') {
      let foundPoint = -1;
      let foundHandle: string | null = null;
      
      currentShape.points.forEach((point, idx) => {
        if (distance({ x, y }, point) < 20) {
          foundPoint = idx;
        } else if (distance({ x, y }, point.handleIn) < 15) {
          foundPoint = idx;
          foundHandle = 'in';
        } else if (distance({ x, y }, point.handleOut) < 15) {
          foundPoint = idx;
          foundHandle = 'out';
        }
      });
      
      if (foundPoint !== -1) {
        setSelectedPoint(foundPoint);
        setDraggingHandle(foundHandle);
        setIsDraggingInSelect(true);
      } else {
        setSelectedPoint(null);
      }
    }
  };
  
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const dimensions = getCanvasDimensions();
    const aspectRatio = dimensions.width / dimensions.height;
    
    // Calculate the actual displayed canvas area (accounting for object-contain)
    let displayWidth = rect.width;
    let displayHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;
    
    // If canvas is letterboxed (width constrained)
    if (rect.width / rect.height > aspectRatio) {
      displayWidth = rect.height * aspectRatio;
      offsetX = (rect.width - displayWidth) / 2;
    } else {
      // If canvas is pillarboxed (height constrained)
      displayHeight = rect.width / aspectRatio;
      offsetY = (rect.height - displayHeight) / 2;
    }
    
    // Mouse coordinates in the logical coordinate system
    const x = ((e.clientX - rect.left - offsetX) / displayWidth) * dimensions.width;
    const y = ((e.clientY - rect.top - offsetY) / displayHeight) * dimensions.height;
    
    // Check if hovering near first point to show close indicator
    if (tool === 'pen' && !isDraggingNewPoint && currentShape.points.length >= 3 && !currentShape.isClosed) {
      const firstPoint = currentShape.points[0];
      const distToFirst = distance({ x, y }, firstPoint);
      setIsHoveringFirstPoint(distToFirst < 30);
    } else {
      setIsHoveringFirstPoint(false);
    }
    
    if (tool === 'pen' && isDraggingNewPoint && newPointIndex !== null) {
      setCurrentShape(prev => {
        const newPoints = [...prev.points];
        const point = newPoints[newPointIndex];
        
        const dx = x - point.x;
        const dy = y - point.y;
        
        point.handleOut = { x, y };
        
        point.handleIn = {
          x: point.x - dx,
          y: point.y - dy
        };
        
        return { ...prev, points: newPoints };
      });
      return;
    }
    
    if (tool === 'select' && isDraggingInSelect && selectedPoint !== null) {
      setCurrentShape(prev => {
        const newPoints = [...prev.points];
        const point = newPoints[selectedPoint];
        
        if (draggingHandle === 'in') {
          point.handleIn = { x, y };
        } else if (draggingHandle === 'out') {
          point.handleOut = { x, y };
        } else {
          const dx = x - point.x;
          const dy = y - point.y;
          point.x = x;
          point.y = y;
          point.handleIn.x += dx;
          point.handleIn.y += dy;
          point.handleOut.x += dx;
          point.handleOut.y += dy;
        }
        
        return { ...prev, points: newPoints };
      });
    }
  };
  
  const handleCanvasMouseUp = () => {
    if (tool === 'select' && isDraggingInSelect && selectedPoint !== null) {
      saveToHistory(currentShape.points);
    }
    
    if (tool === 'pen' && isDraggingNewPoint) {
      saveToHistory(currentShape.points);
    }
    
    setDraggingHandle(null);
    setIsDraggingNewPoint(false);
    setNewPointIndex(null);
    setIsDraggingInSelect(false);
  };
  
  const saveShape = () => {
    if (currentShape.points.length < 2) {
      alert('Please draw at least 2 points');
      return;
    }
    
    // Capture a thumbnail of ONLY the current shape (not other shapes on canvas)
    let thumbnail = '';
    if (canvasRef.current) {
      try {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Save current canvas state
        ctx.save();
        
        const dimensions = getCanvasDimensions();
        
        // Reset transform to work in logical coordinates
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          
          // Clear canvas using logical dimensions
          if (backgroundColor === 'transparent') {
            ctx.clearRect(0, 0, dimensions.width, dimensions.height);
          } else {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, dimensions.width, dimensions.height);
          }
          
          // Draw ONLY the current shape at the center
          drawShape(ctx, currentShape, dimensions.width / 2, dimensions.height / 2);
          
          // Create a temporary canvas for the thumbnail at the correct size
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = dimensions.width;
          tempCanvas.height = dimensions.height;
          const tempCtx = tempCanvas.getContext('2d');
          
          if (tempCtx) {
            // Fill background
            if (backgroundColor === 'transparent') {
              tempCtx.clearRect(0, 0, dimensions.width, dimensions.height);
            } else {
              tempCtx.fillStyle = backgroundColor;
              tempCtx.fillRect(0, 0, dimensions.width, dimensions.height);
            }
            
            // Draw the shape
            drawShape(tempCtx, currentShape, dimensions.width / 2, dimensions.height / 2);
            
            // Capture from temp canvas
            thumbnail = tempCanvas.toDataURL('image/png');
          }
          
          // Restore canvas state
          ctx.restore();
        }
      } catch (e) {
        console.error('Failed to capture thumbnail:', e);
      }
    }
    
    setShapes([...shapes, { ...currentShape, thumbnail }]);
    setShapeVisibility([...shapeVisibility, true]); // New shapes are visible by default
    setCurrentShape({
      ...currentShape,
      points: [],
      isClosed: false
    });
    setSelectedPoint(null);
    setHistory([]);
    setHistoryIndex(-1);
    setShowSavedShapesOnCanvas(true);
  };
  
  const clearCurrentPath = () => {
    const emptyPoints: any[] = [];
    setCurrentShape({ ...currentShape, points: emptyPoints, isClosed: false });
    setSelectedPoint(null);
    setHistory([]);
    setHistoryIndex(-1);
    setIsPlaying(false);
    // Always hide saved shapes when clearing (they'll reappear when animation plays)
    setShowSavedShapesOnCanvas(false);
  };
  
  const deleteShape = (index: number) => {
    const newShapes = shapes.filter((_, i) => i !== index);
    const newVisibility = shapeVisibility.filter((_, i) => i !== index);
    setShapes(newShapes);
    setShapeVisibility(newVisibility);
    if (newShapes.length === 0) {
      setShowSavedShapesOnCanvas(false);
    }
  };
  
  const toggleShapeVisibility = (index: number) => {
    setShapeVisibility(prev => {
      const newVisibility = [...prev];
      // Ensure array is long enough, defaulting to true for missing entries
      while (newVisibility.length <= index) {
        newVisibility.push(true);
      }
      // Toggle: if undefined or true, set to false; if false, set to true
      newVisibility[index] = !isShapeVisible(index);
      return newVisibility;
    });
  };
  
  // Helper to check if shape is visible (defaults to true)
  const isShapeVisible = (index: number) => {
    return shapeVisibility[index] !== false;
  };
  
  const editShape = (index: number) => {
    const shapeToEdit = shapes[index];
    if (!shapeToEdit) return;
    
    // Load the shape into currentShape for editing
    setCurrentShape({
      points: [...shapeToEdit.points],
      iterations: shapeToEdit.iterations,
      rotation: shapeToEdit.rotation,
      scale: shapeToEdit.scale,
      opacity: shapeToEdit.opacity,
      color: shapeToEdit.color,
      startWidth: shapeToEdit.startWidth,
      endWidth: shapeToEdit.endWidth,
      displacementAmount: shapeToEdit.displacementAmount || shapeToEdit.distortion || 0,
      iterationDistortion: shapeToEdit.iterationDistortion || 0,
      uniformity: shapeToEdit.uniformity !== undefined ? shapeToEdit.uniformity : 0.5,
      isClosed: shapeToEdit.isClosed || false
    });
    
    // Remove the shape from saved shapes (user can save it again after editing)
    const newShapes = shapes.filter((_, i) => i !== index);
    const newVisibility = shapeVisibility.filter((_, i) => i !== index);
    setShapes(newShapes);
    setShapeVisibility(newVisibility);
    
    // Clear history and reset to allow new edits
    setHistory([[...shapeToEdit.points]]);
    setHistoryIndex(0);
    setSelectedPoint(null);
    
    // Hide saved shapes on canvas to show the edited shape
    setShowSavedShapesOnCanvas(false);
  };
  
  const reorderShapes = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    const newShapes = [...shapes];
    const newVisibility = [...shapeVisibility];
    const [movedShape] = newShapes.splice(fromIndex, 1);
    const [movedVisibility] = newVisibility.splice(fromIndex, 1);
    newShapes.splice(toIndex, 0, movedShape);
    newVisibility.splice(toIndex, 0, movedVisibility);
    setShapes(newShapes);
    setShapeVisibility(newVisibility);
  };
  
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedShapeIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index.toString());
    
    // Create a custom drag image with border
    const target = e.currentTarget as HTMLElement;
    const dragImage = target.cloneNode(true) as HTMLElement;
    dragImage.style.border = '2px solid #4b5563'; // gray-600
    dragImage.style.opacity = '0.8';
    dragImage.style.transform = 'rotate(2deg)';
    document.body.appendChild(dragImage);
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    e.dataTransfer.setDragImage(dragImage, e.clientX - target.getBoundingClientRect().left, e.clientY - target.getBoundingClientRect().top);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };
  
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };
  
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };
  
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedShapeIndex !== null && draggedShapeIndex !== dropIndex) {
      reorderShapes(draggedShapeIndex, dropIndex);
    }
    setDraggedShapeIndex(null);
    setDragOverIndex(null);
  };
  
  const handleDragEnd = () => {
    setDraggedShapeIndex(null);
    setDragOverIndex(null);
  };
  
  const exportVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || shapes.length < 2) return;
    
    // Check if MediaRecorder is supported
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
      alert('Video recording is not supported in your browser. Please use a modern browser like Chrome, Firefox, or Edge.');
      return;
    }
    
    try {
      // Calculate recording duration (one complete loop)
      const totalDuration = morphDuration * 1000 * shapes.length;
      
      // Ensure saved shapes are visible during recording
      const wasShowingShapes = showSavedShapesOnCanvas;
      if (!wasShowingShapes) {
        setShowSavedShapesOnCanvas(true);
        // Wait a frame for the state to update
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      
      // Stop any existing animation playback
      const wasPlaying = isPlaying;
      if (wasPlaying) {
        setIsPlaying(false);
        // Wait a frame for the state to update
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      
      // Get canvas stream at 60fps
      const stream = canvas.captureStream(60);
      
      // Set up MediaRecorder with MP4/H.264 format and good quality
      const options: MediaRecorderOptions = {
        mimeType: 'video/mp4',
        videoBitsPerSecond: 5000000, // 5 Mbps for good quality
      };
      
      // Try different MP4/H.264 codec options
      if (!MediaRecorder.isTypeSupported(options.mimeType || '')) {
        options.mimeType = 'video/webm;codecs=h264';
        if (!MediaRecorder.isTypeSupported(options.mimeType || '')) {
          options.mimeType = 'video/webm;codecs=vp9';
          if (!MediaRecorder.isTypeSupported(options.mimeType || '')) {
            options.mimeType = 'video/webm;codecs=vp8';
            if (!MediaRecorder.isTypeSupported(options.mimeType || '')) {
              options.mimeType = 'video/webm';
            }
          }
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      
      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        // Determine file extension based on mime type
        const mimeType = mediaRecorder.mimeType || 'video/webm';
        const isMP4 = mimeType.includes('mp4') || mimeType.includes('h264');
        const fileExtension = isMP4 ? 'mp4' : 'webm';
        const blobType = isMP4 ? 'video/mp4' : 'video/webm';
        
        const blob = new Blob(recordedChunksRef.current, { type: blobType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vector-morph-${Date.now()}.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Clean up
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setRecordingProgress(0);
        
        // Restore previous state
        if (!wasShowingShapes) {
          setShowSavedShapesOnCanvas(false);
        }
        if (wasPlaying) {
          setIsPlaying(true);
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        alert('An error occurred while recording the video. Please try again.');
        setIsRecording(false);
        setRecordingProgress(0);
        mediaRecorderRef.current = null;
        recordedChunksRef.current = [];
        
        // Restore previous state
        if (!wasShowingShapes) {
          setShowSavedShapesOnCanvas(false);
        }
        if (wasPlaying) {
          setIsPlaying(true);
        }
      };
      
      // Start recording
      setIsRecording(true);
      setRecordingProgress(0);
      recordingStartTimeRef.current = performance.now();
      mediaRecorder.start(100); // Collect data every 100ms
      
      // Start animation playback for recording
      setIsPlaying(true);
      
      // Set up progress tracking
      const progressInterval = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const elapsed = performance.now() - recordingStartTimeRef.current;
          const progress = Math.min((elapsed / totalDuration) * 100, 100);
          setRecordingProgress(progress);
        }
      }, 100);
      
      // Stop recording after one complete loop
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        clearInterval(progressInterval);
        
        // Stop all tracks to release resources
        stream.getTracks().forEach(track => track.stop());
      }, totalDuration);
      
    } catch (error) {
      console.error('Error starting video export:', error);
      alert('Failed to start video recording. Please try again.');
      setIsRecording(false);
      setRecordingProgress(0);
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
    }
  };
  
  const exportAsEmbed = async () => {
    if (shapes.length < 2) {
      alert('Please create at least 2 shapes to export an animation.');
      return;
    }
    
    // Serialize animation data
    const animationData = {
      shapes: shapes,
      morphDuration: morphDuration,
      easingCurve: easingCurve,
      customCurve: easingCurve === 'custom' ? customCurve : null,
      backgroundColor: backgroundColor
    };
    
    // Generate the HTML content
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vector Morph</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      background-color: ${backgroundColor === 'transparent' ? 'transparent' : backgroundColor};
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
    
    #animation-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 0;
      box-sizing: border-box;
    }
    
    #morphCanvas {
      display: block;
      background-color: ${backgroundColor === 'transparent' ? 'transparent' : backgroundColor};
      max-width: 100%;
      max-height: 100%;
    }
    
    @media (max-width: 900px) {
      #morphCanvas {
        width: 100vw;
        height: auto;
      }
    }
  </style>
</head>
<body>
  <!-- Copy this entire file and embed via iframe or paste directly into your site -->
  <div id="animation-container">
    <canvas id="morphCanvas"></canvas>
  </div>

  <script>
    // Embedded animation data
    const animationData = ${JSON.stringify(animationData, null, 2)};
    
    // Helper functions
    function lerp(a, b, t) {
      return a + (b - a) * t;
    }
    
    function hexToRgb(hex) {
      const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 255, g: 255, b: 255 };
    }
    
    function rgbToHex(r, g, b) {
      return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
    }
    
    function lerpColor(color1, color2, t) {
      const c1 = hexToRgb(color1);
      const c2 = hexToRgb(color2);
      return rgbToHex(
        lerp(c1.r, c2.r, t),
        lerp(c1.g, c2.g, t),
        lerp(c1.b, c2.b, t)
      );
    }
    
    function lerpPoint(p1, p2, t) {
      return {
        x: lerp(p1.x, p2.x, t),
        y: lerp(p1.y, p2.y, t),
        handleIn: {
          x: lerp(p1.handleIn.x, p2.handleIn.x, t),
          y: lerp(p1.handleIn.y, p2.handleIn.y, t)
        },
        handleOut: {
          x: lerp(p1.handleOut.x, p2.handleOut.x, t),
          y: lerp(p1.handleOut.y, p2.handleOut.y, t)
        }
      };
    }
    
    // Flow field that creates directional, flowing distortion
    function flowField(x, y, time, scale) {
      // Create flowing directional field using sine waves
      const angleX = Math.sin(x * 0.01 + time * 0.3) * Math.cos(y * 0.008);
      const angleY = Math.cos(x * 0.008 + time * 0.2) * Math.sin(y * 0.01);
      
      // Combine multiple frequencies for complexity
      const angle = angleX + angleY + 
                    Math.sin(x * 0.005 + y * 0.005 + time * 0.5) * 0.5;
      
      return {
        x: Math.cos(angle) * scale,
        y: Math.sin(angle) * scale
      };
    }
    
    // Seeded random for consistent but varied distortion per iteration
    function seededRandom(seed) {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    }
    
    function interpolateShape(shape1, shape2, t) {
      const maxPoints = Math.max(shape1.points.length, shape2.points.length);
      const points1 = [...shape1.points];
      const points2 = [...shape2.points];
      
      while (points1.length < maxPoints) {
        const last = points1[points1.length - 1];
        points1.push({ ...last });
      }
      while (points2.length < maxPoints) {
        const last = points2[points2.length - 1];
        points2.push({ ...last });
      }
      
      return {
        points: points1.map((p, i) => lerpPoint(p, points2[i], t)),
        iterations: Math.round(lerp(shape1.iterations, shape2.iterations, t)),
        rotation: lerp(shape1.rotation, shape2.rotation, t),
        scale: lerp(shape1.scale, shape2.scale, t),
        opacity: lerp(shape1.opacity, shape2.opacity, t),
        color: lerpColor(shape1.color, shape2.color, t),
        startWidth: lerp(shape1.startWidth, shape2.startWidth, t),
        endWidth: lerp(shape1.endWidth, shape2.endWidth, t),
        displacementAmount: lerp(
          shape1.displacementAmount !== undefined ? shape1.displacementAmount : (shape1.distortion || 0),
          shape2.displacementAmount !== undefined ? shape2.displacementAmount : (shape2.distortion || 0),
          t
        ),
        iterationDistortion: lerp(shape1.iterationDistortion || 0, shape2.iterationDistortion || 0, t),
        uniformity: lerp(shape1.uniformity !== undefined ? shape1.uniformity : 0.5, shape2.uniformity !== undefined ? shape2.uniformity : 0.5, t),
        isClosed: shape1.isClosed || shape2.isClosed
      };
    }
    
    function drawBezierPath(ctx, points, isClosed) {
      if (points.length < 2) return;
      
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        
        ctx.bezierCurveTo(
          p0.handleOut.x, p0.handleOut.y,
          p1.handleIn.x, p1.handleIn.y,
          p1.x, p1.y
        );
      }
      
      // Close the path if shape is closed
      if (isClosed && points.length >= 3) {
        const lastPoint = points[points.length - 1];
        const firstPoint = points[0];
        
        ctx.bezierCurveTo(
          lastPoint.handleOut.x, lastPoint.handleOut.y,
          firstPoint.handleIn.x, firstPoint.handleIn.y,
          firstPoint.x, firstPoint.y
        );
      }
      
      ctx.stroke();
    }
    
    function drawShape(ctx, shape, centerX, centerY) {
      if (shape.points.length < 2) return;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      
      // Scale coordinates from design dimensions to current render dimensions
      const scale = currentScale;
      const adjustedPoints = shape.points.map(p => ({
        x: (p.x - DESIGN_WIDTH / 2) * scale,
        y: (p.y - DESIGN_HEIGHT / 2) * scale,
        handleIn: { 
          x: (p.handleIn.x - DESIGN_WIDTH / 2) * scale, 
          y: (p.handleIn.y - DESIGN_HEIGHT / 2) * scale 
        },
        handleOut: { 
          x: (p.handleOut.x - DESIGN_WIDTH / 2) * scale, 
          y: (p.handleOut.y - DESIGN_HEIGHT / 2) * scale 
        }
      }));
      
      for (let i = 0; i < shape.iterations; i++) {
        const t = i / shape.iterations;
        const lineWidth = lerp(shape.startWidth, shape.endWidth, t) * scale;
        const alpha = shape.opacity * (1 - t * 0.3);
        
        const rgb = hexToRgb(shape.color);
        ctx.strokeStyle = \`rgba(\${rgb.r}, \${rgb.g}, \${rgb.b}, \${alpha})\`;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Apply smooth distortion to the actual shape points
        const displacementAmount = shape.displacementAmount !== undefined ? shape.displacementAmount : (shape.distortion || 0);
        const iterationDistortion = shape.iterationDistortion || 0;
        const uniformity = shape.uniformity !== undefined ? shape.uniformity : 0.5;
        
        let pointsToDraw = adjustedPoints;
        
        if (displacementAmount > 0) {
          // Apply flow field distortion to create smooth, directional warping
          // Uniformity controls randomness: 0 = very random, 1 = uniform
          const randomRange = (1 - uniformity) * 0.6; // Max range when uniformity = 0
          const iterationVariation = seededRandom(i * 12.9898) * randomRange + (1 - randomRange); // Range based on uniformity
          const randomScale = displacementAmount * iterationVariation;
          
          // Iteration distortion controls time-based variation
          const time = i * 0.1 * (1 + iterationDistortion * 0.5); // More variation with higher iterationDistortion
          
          pointsToDraw = adjustedPoints.map((point) => {
            // Sample flow field at point position with random variation
            const flow = flowField(point.x, point.y, time, randomScale * 30 * scale);
            
            // Sample flow for handles (offset sampling positions for variety)
            const flowHandleIn = flowField(
              point.handleIn.x + 50, 
              point.handleIn.y + 50, 
              time, 
              randomScale * 20 * scale
            );
            const flowHandleOut = flowField(
              point.handleOut.x - 50, 
              point.handleOut.y - 50, 
              time, 
              randomScale * 20 * scale
            );
            
            return {
              x: point.x + flow.x,
              y: point.y + flow.y,
              handleIn: {
                x: point.handleIn.x + flowHandleIn.x,
                y: point.handleIn.y + flowHandleIn.y
              },
              handleOut: {
                x: point.handleOut.x + flowHandleOut.x,
                y: point.handleOut.y + flowHandleOut.y
              }
            };
          });
        }
        
        // Draw the distorted (or original) points
        drawBezierPath(ctx, pointsToDraw, shape.isClosed || false);
        
        ctx.rotate((shape.rotation * Math.PI) / 180);
        ctx.scale(shape.scale, shape.scale);
      }
      
      ctx.restore();
    }
    
    // Easing functions
    const easingFunctions = {
      linear: t => t,
      easeIn: t => t * t,
      easeOut: t => t * (2 - t),
      easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
      bounce: t => {
        if (t < 0.5) return 8 * t * t * t * t;
        const f = t - 1;
        return 1 + 8 * f * f * f * f;
      },
      custom: t => {
        const customCurve = animationData.customCurve;
        if (!customCurve || customCurve.length !== 2) return t;
        
        const p0 = customCurve[0];
        const p1 = customCurve[1];
        
        // Cubic bezier interpolation
        const cp1x = p0.handleOut?.x ?? p0.x;
        const cp1y = p0.handleOut?.y ?? p0.y;
        const cp2x = p1.handleIn?.x ?? p1.x;
        const cp2y = p1.handleIn?.y ?? p1.y;
        
        // Binary search to find t value that gives us the input x
        let tMin = 0, tMax = 1;
        let currentT = t;
        
        for (let iter = 0; iter < 10; iter++) {
          const bezierX = Math.pow(1 - currentT, 3) * p0.x +
                         3 * Math.pow(1 - currentT, 2) * currentT * cp1x +
                         3 * (1 - currentT) * Math.pow(currentT, 2) * cp2x +
                         Math.pow(currentT, 3) * p1.x;
          
          if (Math.abs(bezierX - t) < 0.001) break;
          
          if (bezierX < t) {
            tMin = currentT;
          } else {
            tMax = currentT;
          }
          currentT = (tMin + tMax) / 2;
        }
        
        // Calculate y using the found t
        const bezierY = Math.pow(1 - currentT, 3) * p0.y +
                       3 * Math.pow(1 - currentT, 2) * currentT * cp1y +
                       3 * (1 - currentT) * Math.pow(currentT, 2) * cp2y +
                       Math.pow(currentT, 3) * p1.y;
        
        return bezierY;
      }
    };
    
    // Canvas setup
    const canvas = document.getElementById('morphCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('animation-container');
    
    // Original design dimensions
    const DESIGN_WIDTH = 800;
    const DESIGN_HEIGHT = 500;
    const aspectRatio = DESIGN_WIDTH / DESIGN_HEIGHT;
    
    // Store current scale for coordinate transformation
    let currentScale = 1;
    
    // Set canvas size - dynamically scales with container at high resolution
    function resizeCanvas() {
      if (!container) return;
      
      // Get container dimensions
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // Calculate canvas display size to fit container while maintaining aspect ratio
      let displayWidth = containerWidth;
      let displayHeight = displayWidth / aspectRatio;
      
      // If height is too large, constrain by height
      if (displayHeight > containerHeight) {
        displayHeight = containerHeight;
        displayWidth = displayHeight * aspectRatio;
      }
      
      // Get device pixel ratio for high-DPI displays (retina, etc)
      const dpr = window.devicePixelRatio || 1;
      
      // Set canvas internal resolution at device pixel ratio for crisp rendering
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      
      // Set canvas display size
      canvas.style.width = displayWidth + 'px';
      canvas.style.height = displayHeight + 'px';
      
      // Calculate scale factor from design dimensions to actual render dimensions
      currentScale = (displayWidth * dpr) / DESIGN_WIDTH;
      
      // Scale context to account for device pixel ratio
      ctx.scale(dpr, dpr);
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Use ResizeObserver to detect container size changes (for iframe/embed resizing)
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => {
        resizeCanvas();
      });
      resizeObserver.observe(container);
    }
    
    // Animation state
    let isPlaying = true;
    let animationId = null;
    let startTime = null;
    
    // Animation loop
    function animate(timestamp) {
      if (startTime === null) {
        startTime = timestamp;
      }
      
      // Get display dimensions (not physical pixel dimensions)
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.width / dpr;
      const displayHeight = canvas.height / dpr;
      const centerX = displayWidth / 2;
      const centerY = displayHeight / 2;
    
      // Save context state (which includes the DPR scale transform)
      ctx.save();
      
      // Reset transform to identity for clearing/filling
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      // Use background color, or transparent - use physical pixel dimensions for clearRect/fillRect
      if (animationData.backgroundColor === 'transparent') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = animationData.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Restore context state (restores DPR scale)
      ctx.restore();
      
      if (isPlaying && animationData.shapes.length > 1) {
        const totalDuration = animationData.morphDuration * 1000 * animationData.shapes.length;
        const elapsed = timestamp - startTime;
        const progress = (elapsed % totalDuration) / totalDuration;
        
        const shapeIndex = Math.floor(progress * animationData.shapes.length);
        const nextIndex = (shapeIndex + 1) % animationData.shapes.length;
        const localProgress = (progress * animationData.shapes.length) % 1;
        const easedProgress = easingFunctions[animationData.easingCurve](localProgress);
        
        const interpolated = interpolateShape(
          animationData.shapes[shapeIndex],
          animationData.shapes[nextIndex],
          easedProgress
        );
        
        drawShape(ctx, interpolated, centerX, centerY);
      } else if (animationData.shapes.length === 1) {
        drawShape(ctx, animationData.shapes[0], centerX, centerY);
      }
      
      if (isPlaying) {
        animationId = requestAnimationFrame(animate);
      }
    }
    
    // Start animation (always playing)
    animationId = requestAnimationFrame(animate);
  </script>
</body>
</html>`;
    
    // Copy to clipboard instead of downloading
    try {
      await navigator.clipboard.writeText(htmlContent);
      setShowCopyNotification(true);
      setTimeout(() => setShowCopyNotification(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback: download as file
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vector-morph-animation-${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('Clipboard access denied. File downloaded instead.');
    }
  };
  
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  
  // Flow field that creates directional, flowing distortion
  const flowField = (x: number, y: number, time: number, scale: number) => {
    // Create flowing directional field using sine waves
    const angleX = Math.sin(x * 0.01 + time * 0.3) * Math.cos(y * 0.008);
    const angleY = Math.cos(x * 0.008 + time * 0.2) * Math.sin(y * 0.01);
    
    // Combine multiple frequencies for complexity
    const angle = angleX + angleY + 
                  Math.sin(x * 0.005 + y * 0.005 + time * 0.5) * 0.5;
    
    return {
      x: Math.cos(angle) * scale,
      y: Math.sin(angle) * scale
    };
  };
  
  // Seeded random for consistent but varied distortion per iteration
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  };
  
  const rgbToHex = (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  };
  
  const lerpColor = (color1: string, color2: string, t: number) => {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    
    return rgbToHex(
      lerp(c1.r, c2.r, t),
      lerp(c1.g, c2.g, t),
      lerp(c1.b, c2.b, t)
    );
  };
  
  const lerpPoint = (p1: any, p2: any, t: number) => ({
    x: lerp(p1.x, p2.x, t),
    y: lerp(p1.y, p2.y, t),
    handleIn: {
      x: lerp(p1.handleIn.x, p2.handleIn.x, t),
      y: lerp(p1.handleIn.y, p2.handleIn.y, t)
    },
    handleOut: {
      x: lerp(p1.handleOut.x, p2.handleOut.x, t),
      y: lerp(p1.handleOut.y, p2.handleOut.y, t)
    }
  });
  
  const interpolateShape = (shape1: any, shape2: any, t: number) => {
    const maxPoints = Math.max(shape1.points.length, shape2.points.length);
    const points1 = [...shape1.points];
    const points2 = [...shape2.points];
    
    while (points1.length < maxPoints) {
      const last = points1[points1.length - 1];
      points1.push({ ...last });
    }
    while (points2.length < maxPoints) {
      const last = points2[points2.length - 1];
      points2.push({ ...last });
    }
    
    return {
      points: points1.map((p: any, i: number) => lerpPoint(p, points2[i], t)),
      iterations: Math.round(lerp(shape1.iterations, shape2.iterations, t)),
      rotation: lerp(shape1.rotation, shape2.rotation, t),
      scale: lerp(shape1.scale, shape2.scale, t),
      opacity: lerp(shape1.opacity, shape2.opacity, t),
      color: lerpColor(shape1.color, shape2.color, t),
      startWidth: lerp(shape1.startWidth, shape2.startWidth, t),
      endWidth: lerp(shape1.endWidth, shape2.endWidth, t),
      displacementAmount: lerp(
        shape1.displacementAmount !== undefined ? shape1.displacementAmount : (shape1.distortion || 0),
        shape2.displacementAmount !== undefined ? shape2.displacementAmount : (shape2.distortion || 0),
        t
      ),
      iterationDistortion: lerp(shape1.iterationDistortion || 0, shape2.iterationDistortion || 0, t),
      uniformity: lerp(shape1.uniformity !== undefined ? shape1.uniformity : 0.5, shape2.uniformity !== undefined ? shape2.uniformity : 0.5, t),
      isClosed: shape1.isClosed || shape2.isClosed // If either shape is closed, interpolated shape is closed
    };
  };
  // CONTINUATION FROM PART 1
  
  const drawBezierPath = (ctx: CanvasRenderingContext2D, points: any[], isClosed: boolean = false) => {
    if (points.length < 2) return;
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      
      ctx.bezierCurveTo(
        p0.handleOut.x, p0.handleOut.y,
        p1.handleIn.x, p1.handleIn.y,
        p1.x, p1.y
      );
    }
    
    // Close the path if shape is closed
    if (isClosed && points.length >= 3) {
      const lastPoint = points[points.length - 1];
      const firstPoint = points[0];
      
      ctx.bezierCurveTo(
        lastPoint.handleOut.x, lastPoint.handleOut.y,
        firstPoint.handleIn.x, firstPoint.handleIn.y,
        firstPoint.x, firstPoint.y
      );
    }
    
    ctx.stroke();
  };
  
  const drawShape = (ctx: CanvasRenderingContext2D, shape: any, centerX: number, centerY: number) => {
    if (shape.points.length < 2) return;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    
    const adjustedPoints = shape.points.map((p: any) => ({
      x: p.x - centerX,
      y: p.y - centerY,
      handleIn: { x: p.handleIn.x - centerX, y: p.handleIn.y - centerY },
      handleOut: { x: p.handleOut.x - centerX, y: p.handleOut.y - centerY }
    }));
    
    for (let i = 0; i < shape.iterations; i++) {
      const t = i / shape.iterations;
      const lineWidth = lerp(shape.startWidth, shape.endWidth, t);
      const alpha = shape.opacity * (1 - t * 0.3);
      
      // Convert hex color to rgba
      const rgb = hexToRgb(shape.color);
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Apply smooth distortion to the actual shape points
      const displacementAmount = shape.displacementAmount !== undefined ? shape.displacementAmount : (shape.distortion || 0);
      const iterationDistortion = shape.iterationDistortion || 0;
      const uniformity = shape.uniformity !== undefined ? shape.uniformity : 0.5;
      
      let pointsToDraw = adjustedPoints;
      
      if (displacementAmount > 0) {
        // Apply flow field distortion to create smooth, directional warping
        // Uniformity controls randomness: 0 = very random, 1 = uniform
        const randomRange = (1 - uniformity) * 0.6; // Max range when uniformity = 0
        const iterationVariation = seededRandom(i * 12.9898) * randomRange + (1 - randomRange); // Range based on uniformity
        const randomScale = displacementAmount * iterationVariation;
        
        // Iteration distortion controls time-based variation
        const time = i * 0.1 * (1 + iterationDistortion * 0.5); // More variation with higher iterationDistortion
        
        pointsToDraw = adjustedPoints.map((point: any) => {
          // Sample flow field at point position with random variation
          const flow = flowField(point.x, point.y, time, randomScale * 30);
          
          // Sample flow for handles (offset sampling positions for variety)
          const flowHandleIn = flowField(
            point.handleIn.x + 50, 
            point.handleIn.y + 50, 
            time, 
            randomScale * 20
          );
          const flowHandleOut = flowField(
            point.handleOut.x - 50, 
            point.handleOut.y - 50, 
            time, 
            randomScale * 20
          );
          
          return {
            x: point.x + flow.x,
            y: point.y + flow.y,
            handleIn: {
              x: point.handleIn.x + flowHandleIn.x,
              y: point.handleIn.y + flowHandleIn.y
            },
            handleOut: {
              x: point.handleOut.x + flowHandleOut.x,
              y: point.handleOut.y + flowHandleOut.y
            }
          };
        });
      }
      
      // Draw the distorted (or original) points
      drawBezierPath(ctx, pointsToDraw, shape.isClosed || false);
      
      ctx.rotate((shape.rotation * Math.PI) / 180);
      ctx.scale(shape.scale, shape.scale);
    }
    
    ctx.restore();
  };
  
  const drawShapePreview = (canvas: HTMLCanvasElement, shape: any) => {
    if (!canvas || !shape || !shape.points || shape.points.length < 2) {
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = 120;
    const height = 90;
    
    // Clear canvas with dark background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Calculate bounds of the shape (from main canvas 800x600)
    const bounds = shape.points.reduce((acc: any, p: any) => {
      return {
        minX: Math.min(acc.minX, p.x, p.handleIn.x, p.handleOut.x),
        maxX: Math.max(acc.maxX, p.x, p.handleIn.x, p.handleOut.x),
        minY: Math.min(acc.minY, p.y, p.handleIn.y, p.handleOut.y),
        maxY: Math.max(acc.maxY, p.y, p.handleIn.y, p.handleOut.y)
      };
    }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    
    if (!isFinite(bounds.minX)) {
      return;
    }
    
    const shapeWidth = bounds.maxX - bounds.minX;
    const shapeHeight = bounds.maxY - bounds.minY;
    
    if (shapeWidth <= 0 || shapeHeight <= 0) {
      return;
    }
    
    // Calculate scale to fit 800x600 canvas into 120x90 preview
    const scaleX = (width * 0.9) / shapeWidth;
    const scaleY = (height * 0.9) / shapeHeight;
    const scale = Math.min(scaleX, scaleY);
    
    // Center the shape in preview
    const shapeCenterX = (bounds.minX + bounds.maxX) / 2;
    const shapeCenterY = (bounds.minY + bounds.maxY) / 2;
    
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-shapeCenterX, -shapeCenterY);
    
    // Draw with reduced iterations for preview
    const previewIterations = Math.min(shape.iterations || 10, 10);
    
    for (let i = 0; i < previewIterations; i++) {
      const t = i / previewIterations;
      const lineWidth = lerp(shape.startWidth || 2, shape.endWidth || 0.5, t);
      const alpha = (shape.opacity || 0.8) * (1 - t * 0.3);
      
      const rgb = hexToRgb(shape.color || '#ffffff');
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
      ctx.lineWidth = Math.max(1, lineWidth);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      drawBezierPath(ctx, shape.points, shape.isClosed || false);
      
      ctx.rotate(((shape.rotation || 5) * Math.PI) / 180);
      ctx.scale(shape.scale || 0.97, shape.scale || 0.97);
    }
    
    ctx.restore();
  };
  
  const drawEditor = (ctx: CanvasRenderingContext2D, shape: any, selectedIdx: number | null, hoverFirstPoint: boolean = false) => {
    if (shape.points.length === 0) return;
    
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    drawBezierPath(ctx, shape.points, shape.isClosed || false);
    ctx.setLineDash([]);
    
    shape.points.forEach((point: any, idx: number) => {
      const isSelected = idx === selectedIdx;
      const isFirstPoint = idx === 0;
      const isClosed = shape.isClosed || false;
      const showCloseIndicator = isFirstPoint && hoverFirstPoint && tool === 'pen' && shape.points.length >= 3 && !isClosed;
      
      // Always show handles for selected points or in select mode
      // Also always show first point's handleIn when shape is closed (it's used for closing curve)
      const showHandles = isSelected || tool === 'select' || (isFirstPoint && isClosed);
      
      if (showHandles) {
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(point.handleIn.x, point.handleIn.y);
        ctx.lineTo(point.x, point.y);
        ctx.lineTo(point.handleOut.x, point.handleOut.y);
        ctx.stroke();
        
        ctx.fillStyle = '#00aaff';
        ctx.beginPath();
        ctx.arc(point.handleIn.x, point.handleIn.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(point.handleOut.x, point.handleOut.y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight first point's handleIn when shape is closed to show it's used for closing
        if (isFirstPoint && isClosed) {
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(point.handleIn.x, point.handleIn.y, 7, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      
      // Highlight first point when hovering to close
      if (showCloseIndicator) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.fillStyle = isSelected ? '#333333' : '#dadada';
      ctx.beginPath();
      ctx.arc(point.x, point.y, isSelected ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      
      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  };
  
  const animate = (timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Use logical coordinates based on aspect ratio
    const dimensions = getCanvasDimensions();
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    
    // Use background color, or transparent
    if (backgroundColor === 'transparent') {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    } else {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    }
    
    // Draw saved shapes only if they should be visible on canvas
    if (showSavedShapesOnCanvas) {
      // Filter shapes by visibility (defaults to true if not set)
      const visibleShapes = shapes.filter((_, i) => isShapeVisible(i));
      
      if (visibleShapes.length === 0) {
        // No visible shapes, don't draw anything
      } else if (isPlaying && visibleShapes.length > 1) {
        const totalDuration = morphDuration * 1000 * visibleShapes.length;
        // If recording, use recording start time to ensure animation starts from beginning
        let adjustedTimestamp = timestamp;
        if (isRecording && recordingStartTimeRef.current) {
          adjustedTimestamp = timestamp - recordingStartTimeRef.current;
        }
        const progress = (adjustedTimestamp % totalDuration) / totalDuration;
        
        const shapeIndex = Math.floor(progress * visibleShapes.length);
        const nextIndex = (shapeIndex + 1) % visibleShapes.length;
        const localProgress = (progress * visibleShapes.length) % 1;
        const easedProgress = easingFunctions[easingCurve](localProgress);
        
        const interpolated = interpolateShape(
          visibleShapes[shapeIndex],
          visibleShapes[nextIndex],
          easedProgress
        );
        
        drawShape(ctx, interpolated, centerX, centerY);
      } else {
        // When not playing, draw all visible shapes layered on top of each other
        visibleShapes.forEach(shape => {
          drawShape(ctx, shape, centerX, centerY);
        });
      }
    }
    
    // Draw current shape being edited (foreground layer) with full visual effects
    if (currentShape.points.length > 0 && !isPlaying) {
      // Draw the shape with all its parameters (iterations, rotation, etc.)
      drawShape(ctx, currentShape, centerX, centerY);
      // Then overlay the editor view (handles, points, etc.)
      drawEditor(ctx, currentShape, selectedPoint, isHoveringFirstPoint);
    }
    
    animationRef.current = requestAnimationFrame(animate);
  };
  
  useEffect(() => {
    if (easingCurve === 'custom') {
      const canvas = curveCanvasRef.current;
      if (canvas) {
        canvas.width = 300;
        canvas.height = 200;
      }
      drawCurveEditor();
    }
  }, [customCurve, isDraggingCurvePoint, easingCurve]);
  
  // Calculate canvas dimensions based on aspect ratio
  const getCanvasDimensions = () => {
    const ratios: { [key: string]: { width: number; height: number } } = {
      '1:1': { width: 600, height: 600 },
      '4:3': { width: 800, height: 600 },
      '16:9': { width: 800, height: 450 },
      '16:10': { width: 800, height: 500 },
      '21:9': { width: 840, height: 360 },
      '9:16': { width: 450, height: 800 }, // Portrait
    };
    return ratios[aspectRatio] || { width: 800, height: 500 };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dimensions = getCanvasDimensions();
    
    // Set canvas resolution based on device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    
    // Set internal resolution at device pixel ratio
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    
    // Scale context to maintain coordinate system
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [shapes, currentShape, isPlaying, morphDuration, easingCurve, selectedPoint, tool, showSavedShapesOnCanvas, isRecording, aspectRatio, shapeVisibility, backgroundColor]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop recording if component unmounts
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      // Clean up recorded chunks
      recordedChunksRef.current = [];
    };
  }, []);
  
  useEffect(() => {
    // Redraw all shape previews when shapes change
    const timeoutId = setTimeout(() => {
      shapes.forEach((shape, index) => {
        const canvas = document.querySelector(`canvas.shape-preview[data-shape-index="${index}"]`) as HTMLCanvasElement;
        if (canvas && shape && shape.points && shape.points.length >= 2) {
          // Ensure dimensions are set
          canvas.width = 120;
          canvas.height = 90;
          drawShapePreview(canvas, shape);
        }
      });
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [shapes]);
  // CONTINUATION FROM PART 2
  
  return (
    <>
      {/* Copy Notification */}
      {showCopyNotification && (
        <div className="fixed top-4 right-4 bg-neutral-200 text-[#161616] px-6 py-3 rounded shadow-lg z-50 flex items-center gap-2 animate-fade-in">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          HTML copied to clipboard!
        </div>
      )}
      
      <div className="w-full h-screen bg-[#f5f5f5] text-[#161616] p-4 overflow-hidden flex flex-col">
    {/* Header */}
    <div className="mb-2 pb-2 border-b border-gray-300">
      <h1 className="text-xs font-semibold text-[#161616]">VECTOR MORPH</h1>
      <p className="text-xs text-[#161616] font-light">Version 0.0.0</p>
    </div>
    
    <div className="flex gap-2 flex-1 min-h-0">
    {/* LEFT PANEL */}
    <div className="w-72 flex-shrink-0 overflow-y-auto space-y-1">
      {/* Tools */}
      <div className="bg-[#fafafa] p-2 rounded">
        <div className="flex gap-2 w-full">
          <button
            onClick={() => setTool('pen')}
            className={`flex-1 px-2 py-1.5 rounded flex items-center justify-center gap-1 text-sm border-2 ${
              tool === 'pen' 
                ? 'bg-neutral-200 text-[#161616] border-neutral-200' 
                : 'bg-[#fafafa] text-[#161616] border-neutral-200 hover:bg-neutral-200 hover:text-[#161616] hover:border-neutral-200'
            }`}
          >
            <Pencil size={14} /> Pen
          </button>
          <button
            onClick={() => setTool('select')}
            className={`flex-1 px-2 py-1.5 rounded flex items-center justify-center gap-1 text-sm border-2 ${
              tool === 'select' 
                ? 'bg-neutral-200 text-[#161616] border-neutral-200' 
                : 'bg-[#fafafa] text-[#161616] border-neutral-200 hover:bg-neutral-200 hover:text-[#161616] hover:border-neutral-200'
            }`}
          >
            <Move size={14} /> Select
          </button>
        </div>
        <p className="text-xs text-[#161616] mt-1">
          {tool === 'pen' ? 'Click to add anchor points with bezier handles' : 'Click and drag points or handles to adjust curves'}
        </p>
      </div>

      {/* Iteration Parameters */}
      <div className="bg-white p-2 rounded">
        <button
          onClick={() => setShowIterationParams(!showIterationParams)}
          className="w-full flex justify-between items-center font-medium text-xs py-1 hover:text-[#161616]"
        >
          <span>ITERATION PARAMETERS</span>
          {showIterationParams ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${showIterationParams ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="space-y-1 pt-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-light">Iterations</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={currentShape.iterations}
                  onChange={(e) => setCurrentShape({...currentShape, iterations: Math.min(100, Math.max(5, Number(e.target.value)))})}
                  className="w-15 bg-[#f5f5f5] px-1 py-0.5 rounded text-sm font-light text-right"
                />
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={currentShape.iterations}
                onChange={(e) => setCurrentShape({...currentShape, iterations: Number(e.target.value)})}
                className="w-full"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-light">Rotation</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="-25"
                    max="25"
                    step="0.5"
                    value={currentShape.rotation}
                    onChange={(e) => setCurrentShape({...currentShape, rotation: Math.min(20, Math.max(-20, Number(e.target.value)))})}
                    className="w-15 bg-[#f5f5f5] px-1 py-0.5 rounded text-sm font-light text-right"
                  />
                  <span className="text-xs text-[#161616]">°</span>
                </div>
              </div>
              <input
                type="range"
                min="-25"
                max="25"
                step="0.5"
                value={currentShape.rotation}
                onChange={(e) => setCurrentShape({...currentShape, rotation: Number(e.target.value)})}
                className="w-full"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-light">Scale</label>
                <input
                  type="number"
                  min="0.8"
                  max="1.2"
                  step="0.001"
                  value={currentShape.scale.toFixed(3)}
                  onChange={(e) => setCurrentShape({...currentShape, scale: Math.min(1.15, Math.max(0.85, Number(e.target.value)))})}
                  className="w-15 bg-[#f5f5f5] px-1 py-0.5 rounded text-sm font-light text-right"
                />
              </div>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.001"
                value={currentShape.scale}
                onChange={(e) => setCurrentShape({...currentShape, scale: Number(e.target.value)})}
                className="w-full"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-light">Opacity</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={currentShape.opacity.toFixed(2)}
                  onChange={(e) => setCurrentShape({...currentShape, opacity: Math.min(1, Math.max(0, Number(e.target.value)))})}
                  className="w-15 bg-[#f5f5f5] px-1 py-0.5 rounded text-sm font-light text-right"
                />
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentShape.opacity}
                onChange={(e) => setCurrentShape({...currentShape, opacity: Number(e.target.value)})}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Canvas Parameters */}
      <div className="bg-white p-2 rounded">
        <button
          onClick={() => setShowCanvasParams(!showCanvasParams)}
          className="w-full flex justify-between items-center font-medium text-xs py-1 hover:text-[#161616]"
        >
          <span>CANVAS PARAMETERS</span>
          {showCanvasParams ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${showCanvasParams ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="space-y-1 pt-3">
            <div>
              <label className="block text-sm font-light mb-1">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full bg-[#f5f5f5] px-3 py-2 rounded text-xs font-light"
              >
                <option value="1:1">1:1 (Square)</option>
                <option value="4:3">4:3 (Standard)</option>
                <option value="16:9">16:9 (Widescreen)</option>
                <option value="16:10">16:10 (Default)</option>
                <option value="21:9">21:9 (Ultrawide)</option>
                <option value="9:16">9:16 (Portrait)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-light mb-1 mt-2">Background Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={backgroundColor === 'transparent' ? lastBackgroundColor : backgroundColor}
                  onChange={(e) => {
                    setBackgroundColor(e.target.value);
                    setLastBackgroundColor(e.target.value);
                  }}
                  className="h-10 w-20 rounded cursor-pointer"
                />
                <button
                  onClick={() => {
                    if (backgroundColor === 'transparent') {
                      setBackgroundColor(lastBackgroundColor);
                    } else {
                      setLastBackgroundColor(backgroundColor);
                      setBackgroundColor('transparent');
                    }
                  }}
                  className={`px-3 py-2 rounded text-sm ${
                    backgroundColor === 'transparent'
                      ? 'bg-neutral-200 text-[#161616] hover:bg-neutral-200'
                      : 'bg-neutral-200 text-[#161616] hover:bg-neutral-200'
                  }`}
                >
                  {backgroundColor === 'transparent' ? '✓ Transparent' : 'Make Transparent'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stroke Parameters */}
      <div className="bg-white p-2 rounded">
        <button
          onClick={() => setShowStrokeParams(!showStrokeParams)}
          className="w-full flex justify-between items-center font-medium text-xs py-1 hover:text-[#161616]"
        >
          <span>STROKE PARAMETERS</span>
          {showStrokeParams ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${showStrokeParams ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="space-y-1 pt-3">
            <div>
              <label className="block text-sm font-light mb-1">Stroke Color</label>
              <input
                type="color"
                value={currentShape.color}
                onChange={(e) => setCurrentShape({...currentShape, color: e.target.value})}
                className="w-full h-6 rounded"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-light">Start Width</label>
                <input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={currentShape.startWidth.toFixed(1)}
                  onChange={(e) => setCurrentShape({...currentShape, startWidth: Math.min(10, Math.max(0.1, Number(e.target.value)))})}
                  className="w-15 bg-[#f5f5f5] px-1 py-0.5 rounded text-sm font-light text-right"
                />
              </div>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={currentShape.startWidth}
                onChange={(e) => setCurrentShape({...currentShape, startWidth: Number(e.target.value)})}
                className="w-full"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-light">End Width</label>
                <input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={currentShape.endWidth.toFixed(1)}
                  onChange={(e) => setCurrentShape({...currentShape, endWidth: Math.min(10, Math.max(0.1, Number(e.target.value)))})}
                  className="w-15 bg-[#f5f5f5] px-1 py-0.5 rounded text-sm font-light text-right"
                />
              </div>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={currentShape.endWidth}
                onChange={(e) => setCurrentShape({...currentShape, endWidth: Number(e.target.value)})}
                className="w-full"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-light">Displacement Amount</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={currentShape.displacementAmount?.toFixed(2) || "0.00"}
                  onChange={(e) => setCurrentShape({
                    ...currentShape, 
                    displacementAmount: Math.min(1, Math.max(0, Number(e.target.value)))
                  })}
                  className="w-15 bg-[#f5f5f5] px-1 py-0.5 rounded text-sm font-light text-right"
                />
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentShape.displacementAmount || 0}
                onChange={(e) => setCurrentShape({
                  ...currentShape, 
                  displacementAmount: Number(e.target.value)
                })}
                className="w-full"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-light">Iteration Distortion</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={currentShape.iterationDistortion?.toFixed(2) || "0.00"}
                  onChange={(e) => setCurrentShape({
                    ...currentShape, 
                    iterationDistortion: Math.min(1, Math.max(0, Number(e.target.value)))
                  })}
                  className="w-15 bg-[#f5f5f5] px-1 py-0.5 rounded text-sm font-light text-right"
                />
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentShape.iterationDistortion || 0}
                onChange={(e) => setCurrentShape({
                  ...currentShape, 
                  iterationDistortion: Number(e.target.value)
                })}
                className="w-full"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-light">Uniformity</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={currentShape.uniformity?.toFixed(2) || "0.50"}
                  onChange={(e) => setCurrentShape({
                    ...currentShape, 
                    uniformity: Math.min(1, Math.max(0, Number(e.target.value)))
                  })}
                  className="w-15 bg-[#f5f5f5] px-1 py-0.5 rounded text-sm font-light text-right"
                />
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentShape.uniformity !== undefined ? currentShape.uniformity : 0.5}
                onChange={(e) => setCurrentShape({
                  ...currentShape, 
                  uniformity: Number(e.target.value)
                })}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Animation Parameters */}
      <div className="bg-white p-2 rounded">
        <button
          onClick={() => setShowAnimationParams(!showAnimationParams)}
          className="w-full flex justify-between items-center font-medium text-xs py-1 hover:text-[#161616]"
        >
          <span>ANIMATION PARAMETERS</span>
          {showAnimationParams ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${showAnimationParams ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="space-y-1 pt-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-light">Morph Duration</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={morphDuration}
                  onChange={(e) => setMorphDuration(Math.min(10, Math.max(0.5, Number(e.target.value))))}
                  className="w-16 bg-[#f5f5f5] px-2 py-1 rounded text-sm font-light text-right"
                />
                <span className="text-xs text-[#161616]">s</span>
              </div>
            </div>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={morphDuration}
              onChange={(e) => setMorphDuration(Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-light mb-1 ">Easing Curve</label>
            <select
              value={easingCurve}
              onChange={(e) => setEasingCurve(e.target.value)}
              className="w-full bg-[#f5f5f5] px-2 py-1.5 pr-2 rounded font-light"
            >
              <option value="linear">Linear</option>
              <option value="easeIn">Ease In</option>
              <option value="easeOut">Ease Out</option>
              <option value="easeInOut">Ease In Out</option>
              <option value="bounce">Bounce</option>
              <option value="custom">Custom Curve</option>
            </select>
          </div>
          
          {easingCurve === 'custom' && (
            <div className="bg-[#f5f5f5] p-3 rounded">
              <label className="block text-sm font-light mb-2">Custom Interpolation Graph</label>
              <canvas
                ref={curveCanvasRef}
                width={300}
                height={200}
                className="w-full border border-#f5f5f5 cursor-pointer rounded"
                onMouseDown={handleCurveMouseDown}
                onMouseMove={handleCurveMouseMove}
                onMouseUp={handleCurveMouseUp}
                onMouseLeave={handleCurveMouseUp}
              />
              <p className="text-xs text-[#161616] mt-2">
                Drag the control points to customize the animation curve
              </p>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Play/Pause, Export, and Undo/Redo Controls */}
      <div className="bg-white p-2 rounded space-y-2">
        {/* Play/Pause */}
        <div>
        {shapes.length < 2 && (
            <p className="text-sm text-[#161616] text-sm font-light text-center mb-2">
              Create at least 2 shapes to animate
            </p>
          )}
          <button
            onClick={() => {
              const willBePlaying = !isPlaying;
              setIsPlaying(willBePlaying);
              // If starting to play and there are saved shapes, show them on canvas
              if (willBePlaying && shapes.length >= 2) {
                setShowSavedShapesOnCanvas(true);
                // Make all shapes visible when playing animation
                setShapeVisibility(shapes.map(() => true));
              }
            }}
            disabled={shapes.length < 2 || isRecording}
            className={`w-full px-4 py-1.5 rounded flex text-sm items-center justify-center gap-2 ${
              shapes.length < 2 || isRecording
                ? 'bg-transparent border-2 border-neutral-200 text-[#161616] cursor-not-allowed' 
                : 'bg-indigo-700 text-white hover:bg-indigo-800'
            }`}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            {isPlaying ? 'Pause' : 'Play'} Animation
          </button>
          
        </div>

        {/* Export Buttons */}
        <div>
          <div className="flex gap-2">
            <button
              onClick={exportVideo}
              disabled={shapes.length < 2 || isRecording}
              className={`flex-1 px-4 py-1.5 rounded flex items-center text-sm justify-center gap-2 ${
                shapes.length < 2 || isRecording
                  ? 'bg-transparent border-2 border-neutral-200 text-[#161616] cursor-not-allowed' 
                  : 'bg-neutral-200 text-[#161616] hover:bg-neutral-200'
              }`}
            >
              <Download size={20} />
              {isRecording ? `${Math.round(recordingProgress)}%` : 'Export'}
            </button>
            
            <button
              onClick={exportAsEmbed}
              disabled={shapes.length < 2}
              className={`flex-1 px-4 py-1.5 rounded flex items-center text-sm justify-center gap-2 ${
                shapes.length < 2
                  ? 'bg-transparent border-2 border-neutral-200 text-[#161616] cursor-not-allowed' 
                  : 'bg-neutral-200 text-[#161616] hover:bg-neutral-200'
              }`}
            >
              <Code size={20} />
              Embed
            </button>
          </div>
          
          {isRecording && (
            <div className="w-full bg-[#f5f5f5] rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-100"
                style={{ width: `${recordingProgress}%` }}
              />
            </div>
          )}
        </div>

        {/* Undo/Redo */}
        <div>
          <div className="flex gap-2">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className={`flex-1 px-3 py-1 rounded text-sm ${
                historyIndex <= 0 
                  ? 'bg-neutral-200 text-[#161616] cursor-not-allowed opacity-50' 
                  : 'bg-neutral-200 text-[#161616] hover:bg-neutral-200'
              }`}
            >
              ↶ Undo
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className={`flex-1 px-3 py-1 rounded text-sm ${
                historyIndex >= history.length - 1 
                  ? 'bg-neutral-200 text-[#161616] cursor-not-allowed opacity-50' 
                  : 'bg-neutral-200 text-[#161616] hover:bg-neutral-200'
              }`}
            >
              ↷ Redo
            </button>
          </div>
        </div>
      </div>
    </div>

     {/* RIGHT PANEL */}
     <div className="flex-1 flex flex-col gap-1 overflow-hidden">
      {/* Canvas - will shrink to fit available space */}
      <div className="bg-[#f5f5f5] p-2 rounded flex-shrink min-h-0">
        <canvas
          ref={canvasRef}
          className="p-2 cursor-crosshair bg-[#f5f5f5] w-full h-auto max-h-full object-contain"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        />
      </div>

      {/* Save Shape + Clear */}
      <div className="bg-[#f5f5f5] p-1 rounded flex-shrink-0">
        <div className="flex gap-2">
          <button
            onClick={saveShape}
            className="flex-1 bg-indigo-700 text-white hover:bg-indigo-800 px-3 py-1.5 rounded flex items-center justify-center gap-2 text-sm"
          >
            <Plus size={18} /> Save Shape
          </button>
          <button
            onClick={clearCurrentPath}
            className="text-[#161616] border-2 border-neutral-200 hover:bg-neutral-200 hover:text-[#161616] px-3 py-1.5 rounded text-sm"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Saved Shapes Horizontal Carousel - fixed height, always visible */}
      <div className="bg-[#f5f5f5] p-2 rounded flex-shrink-0 h-48">
        <h3 className="font-medium text-xs mb-2">SAVED SHAPES ({shapes.length})</h3>
        
        <div className="flex gap-1 overflow-x-auto h-40 pb-2">
          {shapes.length === 0 ? (
            <p className="text-[#161616] text-center py-8 w-full">
              No shapes saved yet. Draw on the canvas and click "Save Shape"
            </p>
          ) : (
            shapes.map((shape, index) => (
              <div 
                key={index} 
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`bg-[#f5f5f5] p-1 rounded flex-shrink-0 w-40 h-fit cursor-ew-resize transition-all ${
                  draggedShapeIndex === index ? 'opacity-50' : ''
                } ${
                  dragOverIndex === index && draggedShapeIndex !== index ? 'ring-2 ring-gray-400' : ''
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs">Shape {index + 1}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleShapeVisibility(index);
                        }}
                        className="bg-neutral-200 text-[#161616] hover:bg-neutral-300 p-1 rounded"
                        title={isShapeVisible(index) ? "Hide shape from animation" : "Show shape in animation"}
                      >
                        {isShapeVisible(index) ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          editShape(index);
                        }}
                        className="bg-neutral-200 text-[#161616] hover:bg-neutral-300 p-1 rounded"
                        title="Edit shape"
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteShape(index);
                        }}
                        className="bg-neutral-200 text-[#161616] hover:bg-neutral-300 p-1 rounded"
                        title="Delete shape"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  
                  <span className="text-xs text-[#161616]">
                    {shape.points.length} pts
                  </span>
                  
                  {shape.thumbnail ? (
                    <img
                      src={shape.thumbnail}
                      alt={`Shape ${index + 1}`}
                      className="border border-zinc-300 rounded bg-[#fafafa] w-full h-auto"
                      style={{ aspectRatio: '800/500' }}
                    />
                  ) : (
                    <canvas
                      ref={(canvas) => {
                        if (canvas) {
                          canvas.width = 120;
                          canvas.height = 90;
                          drawShapePreview(canvas, shape);
                        }
                      }}
                      className="shape-preview border border-zinc-300 rounded bg-[#fafafa]"
                      data-shape-index={index}
                      width={120}
                      height={90}
                      style={{ width: '100%', height: 'auto' }}
                    />
                  )}
                  
                  <div className="text-xs text-[#161616]">
                    I: {shape.iterations} • R: {shape.rotation}° • S: {shape.scale.toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  </div>
</div>
    </>
  );
};

export default VectorMorphTool;