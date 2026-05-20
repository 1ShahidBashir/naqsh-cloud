import React, { useRef, useState, useEffect } from 'react'

const Canvas = ({socket, roomId}) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const prevPoint = useRef(null);
    const historyRef = useRef([]);//for window resizing arch
    // const [isNeon, setIsNeon]= useState(false);
    const [tool, setTool]= useState('pencil');
    //for clustering points into a stroke
    const currentStrokeId= useRef(null); //useRef so it doesn't trigger renrender
    useEffect(()=>{
        if(socket && roomId){
            //join the room
            socket.emit("join-room", roomId);
        }
    }, [socket, roomId]);

    // This runs once when the component mounts
    useEffect(() => {
        const canvas = canvasRef.current;
        // Setting the canvas size to the window size so you have a big whiteboard
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }, [])

    // depr: i used
    // const startDrawing = ({ nativeEvent }) => {
    //     const { offsetX, offsetY } = nativeEvent;
        
    //     setIsDrawing(true);
    //     // SAVE THE START POINT
    //     prevPoint.current = { x: offsetX, y: offsetY };

    //     const ctx = canvasRef.current.getContext('2d');
    //     ctx.beginPath();
    //     ctx.moveTo(offsetX, offsetY);
    //     ctx.strokeStyle = color; // Make sure color is set here!
    // }

    const startDrawing = ({ nativeEvent }) => {
        // 1. Use  helper!
        const point = computePointInCanvas(nativeEvent);

        setIsDrawing(true);
        
        // 2. Save NORMALIZED data (0.5), not pixels (500)
        prevPoint.current = point;

        //stroke cluster for stoke unique ID
        currentStrokeId.current= Date.now();
    }

    const draw = ({ nativeEvent }) => {
        if (!isDrawing) return;

        //---------- depr i used it earlier to get currentpoint with fixed pixels and not viewport wise
        // const { offsetX, offsetY } = nativeEvent;
        // const currentPoint = { x: offsetX, y: offsetY };

        const currentPoint = computePointInCanvas(nativeEvent);
        const ctx = canvasRef.current.getContext('2d');

        // 1. Draw Locally using our new helper
        drawLine({ prevPoint: prevPoint.current, currentPoint, ctx, color, tool, strokeId: currentStrokeId.current});

        historyRef.current.push({ 
            prevPoint: prevPoint.current, 
            currentPoint, 
            color,
            tool,
            strokeId: currentStrokeId.current
        });

        // 2. Send to Server
        if (socket) {
            socket.emit("draw-line", {
                prevPoint: prevPoint.current,
                currentPoint,
                color,
                roomId,
                tool,
                strokeId: currentStrokeId.current
            });
        }

        // 3. Update previous point
        prevPoint.current = currentPoint;
    }

    const stopDrawing = () => {
        // 1. Get context
        // 2. Close the path
        // 3. Set isDrawing to false
        const ctx= canvasRef.current.getContext('2d');
        ctx.closePath();
        setIsDrawing(false);
    }

    // Helper to normalize
    const computePointInCanvas = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();

        //setting coordinates depending on touch or mouse event
        //-->check if touch event? take x from touch: take x from mouse -- similarly for y
        const clientX= e.touches? e.touches[0].clientX: e.clientX;
        const clientY= e.touches? e.touches[0].clientY: e.clientY;
        
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        // RETURN NORMALIZED (0-1)
        return { 
            x: x / canvas.width, 
            y: y / canvas.height 
        }
    }

    // ---------------------  depr used fixed pixels to draw
    // const drawLine = ({ prevPoint, currentPoint, ctx, color }) => {
    //     const { x: currX, y: currY } = currentPoint;
    //     const { x: prevX, y: prevY } = prevPoint;
        
    //     // 1. Set the color
    //     ctx.strokeStyle = color;
    //     ctx.lineWidth = 2; // Optional: set a standard width
    //     ctx.lineCap = 'round'; // Makes lines look smoother
    //     ctx.lineJoin= 'round';

    //     // 2. Draw the path
    //     ctx.beginPath();
    //     ctx.moveTo(prevX, prevY);
    //     ctx.lineTo(currX, currY);
    //     ctx.stroke();
    // }

    const drawLine = ({ prevPoint, currentPoint, ctx, color, tool, strokeId}) => {
        // Read current canvas size
        const { width, height } = ctx.canvas;

        const startX = prevPoint.x * width;
        const startY = prevPoint.y * height;
        const endX = currentPoint.x * width;
        const endY = currentPoint.y * height;

        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin= 'round';
        ctx.strokeStyle = color;

        const baseWidth= width*0.002; //width based on screen size so that relative sizes shown on devices
        if(tool==='neon'){
            //create a blur with same color and increase line width : all -> neon effect
            ctx.shadowBlur= width*0.01; //relative width
            ctx.shadowColor= color;
            ctx.lineWidth= baseWidth*2.5;
        }
        else if(tool=='pencil'){
            ctx.shadowBlur= 0;
            ctx.lineWidth= baseWidth;
        }
        else if(tool=='eraser'){
            ctx.shadowBlur= 0;
            ctx.lineWidth= baseWidth*8;
            ctx.strokeStyle= '#ffffff'
        }
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }

    //---------------------------------------
    const clearScreen=()=>{
        const canvas= canvasRef.current;
        const ctx= canvas.getContext('2d');
        ctx.clearRect(0,0, canvas.width, canvas.height);
        historyRef.current=[];
        if(socket){
            socket.emit('clear-screen', roomId);
        }
    }
    //---------------------------------------


    //Canvas Resize on Window Resize
    useEffect(()=>{
        const handleResize= ()=>{
            const canvas= canvasRef.current;
            const ctx= canvas.getContext('2d');

            // const imageData= ctx.getImageData(0,0,canvas.width, canvas.height); //depr: used to crop images
            canvas.width= window.innerWidth;
            canvas.height= window.innerHeight;

            // ctx.putImageData(imageData, 0, 0); //depr: just like above

            //instead of imageData we use history to store strokes
            historyRef.current.forEach(line => {
                drawLine({ ...line, ctx });
            });

        }
        window.addEventListener('resize', handleResize);
        return()=>{
            window.removeEventListener('resize', handleResize);
        }
    },[]);

    useEffect(() => {
        if (!socket) return;

        // Listen for the event from the server
        socket.on("draw-line", ({ prevPoint, currentPoint, color , tool, strokeId}) => {
            const ctx = canvasRef.current.getContext('2d');
            // Call the same helper function!
            drawLine({ prevPoint, currentPoint, ctx, color , tool, strokeId});
            historyRef.current.push({ prevPoint, currentPoint, color , tool, strokeId});
        });

        //listener for history replay
        socket.on('get-canvas-state', (state)=>{
            console.log("state received replaying");
            const canvas=canvasRef.current;
            const ctx= canvas.getContext('2d');
            ctx.clearRect(0,0,canvas.width, canvas.height);
            state.forEach(line => {
                drawLine({...line,ctx});
            });
            historyRef.current = state;
        });
        
        //------------------------------------------
        //clear screen
        socket.on('clear-screen',()=>{
            const canvas= canvasRef.current;
            const ctx= canvas.getContext('2d');
            ctx.clearRect(0,0,canvas.width, canvas.height);
            historyRef.current = [];
        });
        //-------------------------------------------

        // Cleanup: remove the listener if component unmounts
        return () => {
            socket.off("draw-line");
            socket.off("get-canvas-state"); // Cleanup
            socket.off('clear-screen');
        };
    }, [socket]); // Re-run if socket changes
    
    const undo= ()=>{
        const hLength= historyRef.current.length;
        if(hLength==0) return; //historyRef arr is empty
        const lastLine= historyRef.current[hLength-1];

        //to remove
        const toRemoveId = lastLine.strokeId;

        //now remove by keeping only the lines which are not having to delete id
        historyRef.current= historyRef.current.filter(line=>line.strokeId!=toRemoveId);

        //redrawing whole again-------

        //clean board
        const ctx= canvasRef.current.getContext('2d');
        ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);
        //redraw
        historyRef.current.forEach(line=>{
            drawLine({...line, ctx});
        });
        //------------------------------

        //socket
        socket.emit('undo', roomId);
    }

    const [color, setColor]= useState("black");
    return (
        <>
            <input type="color" onChange={(e)=>setColor(e.target.value)}/>
            <button onClick={clearScreen}>Clear</button>

            {/*tools*/}
            <button 
                onClick={() => setTool('neon')} 
                style={{ background: tool==='neon' ? 'orange' : 'gray' }}>

                {tool==='neon' ? 'Neon Mode ON' : 'Neon Mode OFF'}

            </button>

            <button 
                onClick={() => setTool('pencil')} 
                style={{ background: tool==='pencil' ? 'orange' : 'gray' }}>

                {tool==='pencil' ? 'Pencil Mode ON' : 'Pencil Mode OFF'}

            </button>

            <button 
                onClick={() => setTool('eraser')} 
                style={{ background: tool==='eraser' ? 'orange' : 'gray' }}>

                {tool==='eraser' ? 'Eraser Mode ON' : 'Eraser Mode OFF'}

            </button>

            <button onClick={()=>undo()}>Undo</button>

            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                //same for touchScreen
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                // This ensures the cursor looks like a crosshair
                style={{ cursor: 'crosshair', display: 'block' }} 
            />
        </>
    )
}

export default Canvas