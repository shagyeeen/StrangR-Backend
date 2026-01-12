const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("StrangR backend is alive 🚀");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let waitingUser = null;
const reports = {}; // { ip: count }
const bannedUsers = {}; // { ip: banExpiryTimestamp }

/* ================= HELPERS ================= */

function getIP(socket) {
  return socket.handshake.headers["x-forwarded-for"]?.split(",")[0]
    || socket.handshake.address;
}

function isBanned(ip) {
  if (!bannedUsers[ip]) return false;

  if (Date.now() > bannedUsers[ip]) {
    delete bannedUsers[ip]; // ban expired
    delete reports[ip];
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
      msg: "StrangR user has left the chat"
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

  socket.emit("partner", { username: other.username });
  other.emit("partner", { username: socket.username });

  io.to(room).emit("message", {
    username: "StrangR",
    msg: "You are now chatting on StrangR"
  });
}

/* ================= SOCKET LOGIC ================= */

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  const ip = getIP(socket);

  if (isBanned(ip)) {
    socket.emit("message", {
      username: "StrangR",
      msg: "You are temporarily banned due to reports. Try again later."
    });
    socket.disconnect();
    return;
  }

  /* -------- JOIN -------- */
socket.on("join", (username) => {
  console.log("Join request from:", socket.id);

  socket.username = username;
  leaveRoom(socket);

  if (waitingUser && waitingUser.id !== socket.id) {
    const other = waitingUser;
    waitingUser = null;
    pairUsers(socket, other);
  } else {
    waitingUser = socket;
    socket.emit("message", {
      username: "StrangR",
      msg: "Waiting for StrangR..."
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
        msg: "Waiting for StrangR..."
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
    const ip = getIP(socket);

    reports[ip] = (reports[ip] || 0) + 1;

    console.log(`Report on IP ${ip}: ${reports[ip]}`);

    if (reports[ip] >= 3) {
      bannedUsers[ip] = Date.now() + (10 * 60 * 1000); // 10 min ban

      socket.emit("message", {
        username: "StrangR",
        msg: "You have been temporarily banned due to multiple reports."
      });

      socket.disconnect();
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
