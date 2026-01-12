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

/* ================= HELPERS ================= */

function leaveRoom(socket) {
  if (socket.room) {
    socket.leave(socket.room);
    socket.room = null;
  }
}

function pairUsers(socket, other) {
  const room = `${socket.id}#${other.id}`;

  socket.join(room);
  other.join(room);

  socket.room = room;
  other.room = room;

  io.to(room).emit("message", {
    username: "StrangR",
    msg: "You are now chatting with a stranger"
  });
}

/* ================= SOCKET LOGIC ================= */

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  /* -------- JOIN -------- */
socket.on("join", () => {
  console.log("Join request from:", socket.id);

  leaveRoom(socket);

  if (waitingUser && waitingUser.id !== socket.id) {
    const other = waitingUser;
    waitingUser = null;
    pairUsers(socket, other);
  } else {
    waitingUser = socket;
    socket.emit("message", {
      username: "StrangR",
      msg: "Waiting for a stranger..."
    });
  }
});


  /* -------- NEXT STRANGER -------- */
socket.on("next", () => {
  console.log("Next requested by:", socket.id);

  leaveRoom(socket);

  // If this socket was already waiting, clear it
  if (waitingUser && waitingUser.id === socket.id) {
    waitingUser = null;
  }

  // Pair ONLY if waitingUser exists AND is NOT same socket
  if (waitingUser && waitingUser.id !== socket.id) {
    const other = waitingUser;
    waitingUser = null;
    pairUsers(socket, other);
  } else {
    waitingUser = socket;
    socket.emit("message", {
      username: "StrangR",
      msg: "Waiting for a stranger..."
    });
  }
});


  /* -------- MESSAGE -------- */
  socket.on("message", (data) => {
    if (socket.room) {
      io.to(socket.room).emit("message", data);
    }
  });

  /* -------- DISCONNECT -------- */
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    leaveRoom(socket);

    if (waitingUser === socket) {
      waitingUser = null;
    }
  });
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("StrangR server running on port", PORT);
});
