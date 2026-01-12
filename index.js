const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let waitingUser = null;

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", () => {
    console.log("Join request from:", socket.id);

    if (waitingUser && waitingUser.id !== socket.id) {
      const room = `${socket.id}#${waitingUser.id}`;

      socket.join(room);
      waitingUser.join(room);

      socket.room = room;
      waitingUser.room = room;

      io.to(room).emit("message", {
        username: "StrangR",
        msg: "You are now chatting with a stranger"
      });

      waitingUser = null;
    } else {
      waitingUser = socket;
      socket.emit("message", {
        username: "StrangR",
        msg: "Waiting for a stranger..."
      });
    }
  });

  socket.on("message", (data) => {
    if (socket.room) {
      io.to(socket.room).emit("message", data);
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    if (waitingUser === socket) waitingUser = null;
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("StrangR server running on port", PORT);
});
