import React, { useRef, useState, useEffect } from 'react';

const SERVER_URL = import.meta.env.VITE_SERVER || "http://localhost:3001";

const AICanvas = () => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const prevPoint = useRef(null);
    const historyRef = useRef([]);
    const [tool, setTool] = useState('pencil');
    const [color, setColor] = useState('#1a1a2e');
    const currentStrokeId = useRef(null);

    // AI state
    const [aiResponse, setAiResponse] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showPanel, setShowPanel] = useState(false);

    // AI drawings stored separately
    const aiDrawingsRef = useRef([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    // Canvas resize
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            historyRef.current.forEach(line => {
                drawLine({ ...line, ctx });
            });
            renderAIDrawingsOnCanvas(aiDrawingsRef.current);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const computePointInCanvas = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        return {
            x: x / canvas.width,
            y: y / canvas.height
        };
    };

    const drawLine = ({ prevPoint, currentPoint, ctx, color, tool }) => {
        const { width, height } = ctx.canvas;
        const startX = prevPoint.x * width;
        const startY = prevPoint.y * height;
        const endX = currentPoint.x * width;
        const endY = currentPoint.y * height;

        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = color;

        const baseWidth = width * 0.002;
        if (tool === 'neon') {
            ctx.shadowBlur = width * 0.01;
            ctx.shadowColor = color;
            ctx.lineWidth = baseWidth * 2.5;
        } else if (tool === 'pencil') {
            ctx.shadowBlur = 0;
            ctx.lineWidth = baseWidth;
        } else if (tool === 'eraser') {
            ctx.shadowBlur = 0;
            ctx.lineWidth = baseWidth * 8;
            ctx.strokeStyle = '#ffffff';
        }
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    };

    const startDrawing = ({ nativeEvent }) => {
        const point = computePointInCanvas(nativeEvent);
        setIsDrawing(true);
        prevPoint.current = point;
        currentStrokeId.current = Date.now();
    };

    const draw = ({ nativeEvent }) => {
        if (!isDrawing) return;
        const currentPoint = computePointInCanvas(nativeEvent);
        const ctx = canvasRef.current.getContext('2d');
        drawLine({ prevPoint: prevPoint.current, currentPoint, ctx, color, tool, strokeId: currentStrokeId.current });
        historyRef.current.push({
            prevPoint: prevPoint.current,
            currentPoint,
            color,
            tool,
            strokeId: currentStrokeId.current
        });
        prevPoint.current = currentPoint;
    };

    const stopDrawing = () => {
        const ctx = canvasRef.current.getContext('2d');
        ctx.closePath();
        setIsDrawing(false);
    };

    const clearScreen = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        historyRef.current = [];
        aiDrawingsRef.current = [];
    };

    const undo = () => {
        const hLength = historyRef.current.length;
        if (hLength === 0) {
            if (aiDrawingsRef.current.length > 0) {
                aiDrawingsRef.current = [];
                redrawAll();
            }
            return;
        }
        const lastLine = historyRef.current[hLength - 1];
        const toRemoveId = lastLine.strokeId;
        historyRef.current = historyRef.current.filter(line => line.strokeId !== toRemoveId);
        redrawAll();
    };

    const redrawAll = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        historyRef.current.forEach(line => {
            drawLine({ ...line, ctx });
        });
        renderAIDrawingsOnCanvas(aiDrawingsRef.current);
    };

    // =========== AI DRAWING RENDERER ===========
    // Find the rightmost point of the last stroke (likely the "?")
    // and draw the AI answer slightly to its right
    const getLastStrokeRightEdge = () => {
        const history = historyRef.current;
        if (history.length === 0) return { x: 0.5, y: 0.5 }; // center fallback

        // Get the last strokeId
        const lastStrokeId = history[history.length - 1].strokeId;
        const lastStrokePoints = history.filter(h => h.strokeId === lastStrokeId);

        // Find the rightmost point and its Y in the last stroke
        let maxX = 0;
        let avgY = 0;
        lastStrokePoints.forEach(p => {
            if (p.currentPoint.x > maxX) {
                maxX = p.currentPoint.x;
            }
            avgY += p.currentPoint.y;
        });
        avgY /= lastStrokePoints.length;

        return { x: maxX, y: avgY };
    };

    const drawAIAnswer = (answerText) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { x: normX, y: normY } = getLastStrokeRightEdge();

        // Convert normalized coords to pixels, offset slightly right
        const pixelX = normX * canvas.width + 15;
        const pixelY = normY * canvas.height;

        ctx.save();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.font = `${Math.max(20, canvas.width * 0.018)}px 'Segoe UI', sans-serif`;
        ctx.fillStyle = '#22c55e';
        ctx.textBaseline = 'middle';

        // Handle multi-line
        const lines = answerText.split('\n');
        const lineHeight = Math.max(24, canvas.width * 0.022);
        lines.forEach((line, i) => {
            ctx.fillText(line, pixelX, pixelY + i * lineHeight);
        });
        ctx.restore();

        // Store for redraw on resize
        aiDrawingsRef.current = [{ text: answerText, normX, normY }];
    };

    const renderAIDrawingsOnCanvas = (drawings) => {
        if (!drawings || drawings.length === 0) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        drawings.forEach(d => {
            const pixelX = d.normX * canvas.width + 15;
            const pixelY = d.normY * canvas.height;

            ctx.save();
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.font = `${Math.max(20, canvas.width * 0.018)}px 'Segoe UI', sans-serif`;
            ctx.fillStyle = '#22c55e';
            ctx.textBaseline = 'middle';

            const lines = d.text.split('\n');
            const lineHeight = Math.max(24, canvas.width * 0.022);
            lines.forEach((line, i) => {
                ctx.fillText(line, pixelX, pixelY + i * lineHeight);
            });
            ctx.restore();
        });
    };

    // =========== AI SHARE ===========
    const shareWithAI = async () => {
        const canvas = canvasRef.current;
        const imageData = canvas.toDataURL('image/png');

        setIsAnalyzing(true);
        setAiResponse('');

        try {
            const res = await fetch(`${SERVER_URL}/api/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: imageData,
                    canvasWidth: canvas.width,
                    canvasHeight: canvas.height
                })
            });
            const data = await res.json();
            if (data.error) {
                setAiResponse(`⚠️ ${data.error}`);
                setShowPanel(true);
            } else {
                setAiResponse(data.explanation || data.response || '');
                // Draw the answer on the canvas next to the last stroke
                const answer = data.answer || '';
                if (answer) {
                    drawAIAnswer(answer);
                }
            }
        } catch (err) {
            setAiResponse(`⚠️ Failed to connect to AI service: ${err.message}`);
            setShowPanel(true);
        } finally {
            setIsAnalyzing(false);
        }
    };


    return (
        <>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            <button onClick={clearScreen}>Clear</button>

            <button
                onClick={() => setTool('neon')}
                style={{ background: tool === 'neon' ? 'orange' : 'gray' }}>
                {tool === 'neon' ? 'Neon Mode ON' : 'Neon Mode OFF'}
            </button>

            <button
                onClick={() => setTool('pencil')}
                style={{ background: tool === 'pencil' ? 'orange' : 'gray' }}>
                {tool === 'pencil' ? 'Pencil Mode ON' : 'Pencil Mode OFF'}
            </button>

            <button
                onClick={() => setTool('eraser')}
                style={{ background: tool === 'eraser' ? 'orange' : 'gray' }}>
                {tool === 'eraser' ? 'Eraser Mode ON' : 'Eraser Mode OFF'}
            </button>

            <button onClick={undo}>Undo</button>

            <button
                onClick={shareWithAI}
                disabled={isAnalyzing}
                style={{ background: isAnalyzing ? 'gray' : 'purple', color: 'white' }}>
                {isAnalyzing ? 'Analyzing…' : ' Share with AI'}
            </button>

            {/* Toggle button to show/hide AI response */}
            {aiResponse && (
                <button
                    onClick={() => setShowPanel(!showPanel)}
                    style={{ background: showPanel ? 'green' : 'teal', color: 'white' }}>
                    {showPanel ? 'Hide AI Response' : 'Show AI Response'}
                </button>
            )}

            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair', display: 'block' }}
            />

            {/* AI Response Panel — only shown when toggled */}
            {showPanel && (
                <div style={{
                    position: 'fixed',
                    top: '50px',
                    right: '20px',
                    width: '380px',
                    maxHeight: 'calc(100vh - 80px)',
                    background: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 200,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: '1px solid #eee'
                    }}>
                        <strong> AI Analysis</strong>
                        <button onClick={() => setShowPanel(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
                    </div>
                    <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
                        {isAnalyzing ? (
                            <p>Analyzing your drawing…</p>
                        ) : (
                            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                {aiResponse || 'Draw something and click "Share with AI" to get started!'}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default AICanvas;
