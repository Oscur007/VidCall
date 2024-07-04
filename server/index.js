require("dotenv").config();
const express = require("express");
const path = require("path");
const { Server } = require("socket.io");

const port = process.env.PORT || 8000;

const app = express();
app.use(express.static(path.resolve(__dirname , "../" , process.env.FRONTEND)));
app.get("*" , (req , res)=> {
  res.sendFile(path.resolve(__dirname , "../" , process.env.FRONTEND , "index.html"));
})

const server = app.listen(port);

const io = new Server(server , {
  cors: true,
});

const nameToSocketIdMap = new Map();
const socketidToNameMap = new Map();
const roomUsersMap = new Map();

io.on("connection", (socket) => {
  
  socket.on("room:join", (data) => {
    const { name, room } = data;
    if (!roomUsersMap.has(room)) {
      roomUsersMap.set(room, []);
    }
    const usersInRoom = roomUsersMap.get(room);
    if (usersInRoom.length >= 2) {
      io.to(socket.id).emit('room:full', { message: "You can't join the room now !" });
      return;
    }
    nameToSocketIdMap.set(name, socket.id);
    socketidToNameMap.set(socket.id, name);
    usersInRoom.push(socket.id);
    roomUsersMap.set(room, usersInRoom);
    io.to(room).emit("user:joined", { name, id: socket.id });
    socket.join(room);
    io.to(socket.id).emit("room:join", data);
  });

  socket.on("user:call", ({ to, offer, name }) => {
    io.to(to).emit("incomming:call", { from: socket.id, offer, name });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });

  socket.on('call:end', ({ to }) => {
    const name = socketidToNameMap.get(socket.id);
    nameToSocketIdMap.delete(name);
    socketidToNameMap.delete(socket.id);
    for (const [room, users] of roomUsersMap.entries()) {
      const updatedUsers = users.filter(id => id !== socket.id);
      if (updatedUsers.length === 0) {
        roomUsersMap.delete(room);
      } else {
        roomUsersMap.set(room, updatedUsers);
      }
    }
    io.to(to).emit('call:end');
  });

  socket.on('disconnect' , () => {
    const name = socketidToNameMap.get(socket.id);
    nameToSocketIdMap.delete(name);
    socketidToNameMap.delete(socket.id);
    for (const [room, users] of roomUsersMap.entries()) {
      const updatedUsers = users.filter(id => id !== socket.id);
      if (updatedUsers.length === 0) {
        roomUsersMap.delete(room);
      } else {
        roomUsersMap.set(room, updatedUsers);
      }
    }
  })
});
