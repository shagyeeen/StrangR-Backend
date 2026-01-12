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
const bannedIPs = new Map(); // ip → timestamp

/* ================= HELPERS ================= */

function isBanned(ip) {
  const banTime = bannedIPs.get(ip);
  if (!banTime) return false;

  if (Date.now() - banTime > 10 * 60 * 1000) {
    bannedIPs.delete(ip); // 10 mins ban
    return false;
  }
  return true;
}

function leaveRoom(socket) {
  if (socket.room) {
    const room = socket.room;

    // notify the other user
    socket.to(room).emit("message", {
      username: "StrangR",
      msg: "Stranger has left the chat"
    });

    socket.leave(room);
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

  const ip = socket.handshake.address;

  if (isBanned(ip)) {
    socket.emit("message", {
      username: "StrangR",
      msg: "You are temporarily banned."
    });
    socket.disconnect();
    return;
  }

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

    leaveRoom(socket); // this now sends "Stranger has left"

    if (waitingUser === socket) {
      waitingUser = null;
    }

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

  /* -------- TYPING -------- */
  socket.on("typing", () => {
    if (socket.room) {
      socket.to(socket.room).emit("typing");
    }
  });

  socket.on("stop_typing", () => {
    if (socket.room) {
      socket.to(socket.room).emit("stop_typing");
    }
  });

  /* -------- REPORT -------- */
  socket.on("report", () => {
    const ip = socket.handshake.address;
    bannedIPs.set(ip, Date.now());
    socket.disconnect();
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
