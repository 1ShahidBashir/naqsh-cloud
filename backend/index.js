import express from 'express';
import http, { METHODS } from 'http';
import cors from 'cors';
import { Server } from "socket.io";
import 'dotenv/config';
import Groq from 'groq-sdk';
// ==================== Redis Adapter ====================
// These enable WebSocket events to sync across multiple
// Kubernetes pods via Redis Pub/Sub. Without this, each
// pod would be an isolated island — users on different
// pods couldn't collaborate in real-time.
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";

const app = express();

// Middleware
app.use(cors({
    origin: process.env.CLIENT || "*"
}));
app.use(express.json({ limit: '10mb' })); // large base64 images

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT || "*",
        methods: ["GET", "POST"]
    }
});

// ==================== Redis Adapter Setup ====================
// CONDITIONAL: Only connects if REDIS_URL is provided (e.g., in
// Docker Compose or Kubernetes). In local dev without Redis,
// this block is skipped entirely — your app works the same.
if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log("✅ Redis adapter connected — multi-pod sync enabled");
    }).catch((err) => {
        console.error("❌ Redis adapter failed:", err.message);
    });
} else {
    console.log("ℹ️  No REDIS_URL — running in single-instance mode (local dev)");
}
// =============================================================

// ==================== Groq AI Vision ====================
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/api/analyze', async (req, res) => {
    try {
        const { image, canvasWidth, canvasHeight } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const cw = canvasWidth || 1920;
        const ch = canvasHeight || 1080;

        const systemPrompt = `You are analyzing a whiteboard drawing. Respond with ONLY a valid JSON object (no markdown, no code fences).

FORMAT:
{
  "answer": "Your short answer here (e.g. '5' or '42' or 'x = 7')",
  "explanation": "Your detailed explanation here"
}

RULES:
- Look at the drawing and figure out what is being asked.
- "answer" should be ONLY the direct answer/solution — short and concise (e.g. just the number, just the result).
- "explanation" should contain the detailed reasoning.
- RESPOND WITH ONLY THE JSON OBJECT.`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: systemPrompt
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: image
                            }
                        }
                    ]
                }
            ],
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            temperature: 0.5,
            max_completion_tokens: 2048,
        });

        const rawResponse = chatCompletion.choices[0]?.message?.content || "";

        // Try to parse JSON from the response
        let parsed = null;
        try {
            // Try direct parse first
            parsed = JSON.parse(rawResponse);
        } catch {
            // Try to extract JSON from the response (LLM might wrap it in markdown)
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsed = JSON.parse(jsonMatch[0]);
                } catch {
                    parsed = null;
                }
            }
        }

        if (parsed && parsed.answer) {
            res.json({
                answer: parsed.answer,
                explanation: parsed.explanation || "Analysis complete.",
                response: parsed.explanation || rawResponse
            });
        } else {
            // Fallback: use raw text as answer
            res.json({
                answer: rawResponse,
                explanation: rawResponse,
                response: rawResponse
            });
        }

    } catch (error) {
        console.error("Groq API Error:", error.message);
        res.status(500).json({ error: 'AI analysis failed. ' + error.message });
    }
});
// =========================================================

//Depr: Create storage outside the connection block
// let drawHistory = [];

//use map room to history
const roomState = new Map();

io.on('connection', (socket) => {
    console.log("User Connected:", socket.id);

    socket.on('join-room', (roomId) => {
        socket.join(roomId); //Socket.io built-in room management

        //doesn't exist in map, create it
        if (!roomState.has(roomId)) {
            roomState.set(roomId, []);
        }

        //sending user's room's history
        const history = roomState.get(roomId);
        socket.emit('get-canvas-state', history); //stays same as old
    });

    // DEPR: IMMEDIATE ACTION: Send existing history to the NEW user only
    // We use socket.emit (unicast), NOT io.emit (broadcast)
    // socket.emit('get-canvas-state', drawHistory);

    socket.on("draw-line", ({ prevPoint, currentPoint, color, roomId, tool, strokeId }) => {
        // depr: Add to history
        //drawHistory.push({ prevPoint, currentPoint, color });
        if (roomState.has(roomId)) {
            roomState.get(roomId).push({ prevPoint, currentPoint, color, tool, strokeId });
        }

        // depr: Send to everyone else
        // socket.broadcast.emit("draw-line", { prevPoint, currentPoint, color });
        socket.to(roomId).emit('draw-line', { prevPoint, currentPoint, color, tool, strokeId }); //.to sends to particular place/user in this case room

    });

    //-------------------------------------------------
    // depr
    // socket.on('clear-screen',()=>{
    //     drawHistory= [];
    //     io.emit('clear-screen');
    // });

    socket.on('clear-screen', (roomId) => {
        if (roomState.has(roomId)) {
            roomState.set(roomId, []);
        }

        //broadcast
        socket.to(roomId).emit('clear-screen');
    });

    //-------------------------------------------------

    socket.on('disconnect', () => {
        console.log('User Disconnected:', socket.id);
    });

    //undo
    socket.on('undo', (roomId) => {
        //room present on server
        if (roomState.has(roomId)) {
            const history = roomState.get(roomId);
            //if we have something to undo
            if (history.length > 0) {
                const lastLine = history[history.length - 1];
                const toRemoveId = lastLine.strokeId;
                //filter
                const newHistory = history.filter(line => line.strokeId != toRemoveId);
                //
                roomState.set(roomId, newHistory); //mapping updated
                //sending new history to all in room
                io.to(roomId).emit('get-canvas-state', newHistory);
            }
        }
    });
});

server.listen(process.env.PORT, () => console.log("server listening"));