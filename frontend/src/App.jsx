import React, { useEffect } from 'react'
import Canvas from './Canvas'
import AICanvas from './AICanvas'
import { io } from "socket.io-client";
import {BrowserRouter, Routes, Route, useNavigate, useParams} from "react-router-dom";
import {v4 as uuidv4} from "uuid";
import './App.css';

const SERVER_URL = import.meta.env.VITE_SERVER || "http://localhost:3001";
const socket = io(SERVER_URL); //fix

const Home= ()=>{
  const navigate= useNavigate();
  const createRoom= ()=>{
    const roomId= uuidv4();
    navigate(`/room/${roomId}`);
  }
  return(
    <>
      <button onClick={createRoom}>Create Room</button>
      <button onClick={() => navigate('/ai-canvas')}>Collab with AI</button>
    </>
  )
}


const CanvasPage= ()=>{
  const {roomId}= useParams();
  return(
    <Canvas roomId={roomId} socket={socket}/>
  )
}

const AICanvasPage = () => {
  return <AICanvas />;
};

const App = () => {

  //Test the connection on mount
  useEffect(() => {
    socket.on("connect", () => {
        console.log("Connected to server with ID:", socket.id);
    });
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/room/:roomId" element={<CanvasPage/>}/>
        <Route path="/ai-canvas" element={<AICanvasPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App