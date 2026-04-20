const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let rooms = {};

function makeCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Mafia Pro</title>

<style>
/* 🌈 ANIMATED BACKGROUND */
body {
  font-family: Arial;
  text-align:center;
  color:white;
  margin:0;
  height:100vh;
  background: linear-gradient(-45deg, #000, #1a1a1a, #330000, #111);
  background-size: 400% 400%;
  animation: bg 10s infinite;
}

@keyframes bg {
  0% {background-position:0% 50%;}
  50% {background-position:100% 50%;}
  100% {background-position:0% 50%;}
}

/* INPUT + BUTTON */
input {
  padding:10px;
  margin:5px;
  border-radius:5px;
  border:none;
}

button {
  padding:10px 15px;
  margin:5px;
  border:none;
  border-radius:5px;
  background: crimson;
  color:white;
  cursor:pointer;
  transition:0.3s;
}

button:hover {
  background: gold;
  color:black;
  transform: scale(1.1);
}

/* CARD */
.card {
  margin-top:20px;
  padding:20px;
  border:2px solid white;
  border-radius:10px;
  font-size:24px;
  animation: pop 0.5s ease;
}

@keyframes pop {
  from {transform:scale(0);}
  to {transform:scale(1);}
}

/* HOST VIEW */
.hostList li {
  margin:5px;
  padding:10px;
  border-radius:5px;
  animation: fade 1s ease;
}

@keyframes fade {
  from {opacity:0;}
  to {opacity:1;}
}

.mafia { background:red; }
.doctor { background:green; }
.villager { background:gray; }

</style>
</head>

<body>

<h1>🎮 Mafia Pro</h1>

<input id="name" placeholder="Name">
<input id="room" placeholder="Room Code">
<input id="mafia" placeholder="Mafia Count">
<input id="maxPlayers" placeholder="Max Players">

<br>

<button onclick="create()">Create</button>
<button onclick="join()">Join</button>
<button onclick="start()">Start</button>

<h2 id="code"></h2>

<ul id="players"></ul>

<div id="role"></div>
<ul id="hostView" class="hostList"></ul>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
let code = "";
let isHost = false;

// CREATE
function create(){
  socket.emit("createRoom", {
    name: document.getElementById("name").value,
    mafiaCount: parseInt(document.getElementById("mafia").value) || 1,
    maxPlayers: parseInt(document.getElementById("maxPlayers").value) || 5
  });
}

// JOIN
function join(){
  code = document.getElementById("room").value.trim().toUpperCase();
  socket.emit("joinRoom", {
    name: document.getElementById("name").value,
    code
  });
}

// START
function start(){
  socket.emit("startGame", code);
}

// ROOM CODE
socket.on("roomCode", c=>{
  code = c;
  isHost = true;
  document.getElementById("code").innerText = "Room: " + c + " (HOST)";
});

// PLAYERS
socket.on("players", players=>{
  document.getElementById("players").innerHTML =
    players.map(p=>"<li>"+p.name+"</li>").join("");
});

// PLAYER ROLE
socket.on("role", role=>{
  if(!isHost){
    document.getElementById("role").innerHTML =
      "<div class='card'>🎴 "+role+"</div>";
  }
});

// HOST VIEW
socket.on("hostRoles", list=>{
  if(isHost){
    document.getElementById("hostView").innerHTML =
      list.map(p=>{
        return "<li class='"+p.role.toLowerCase()+"'>"+p.name+" - "+p.role+"</li>";
      }).join("");
  }
});

// ERROR
socket.on("errorMsg", msg=>{
  alert(msg);
});
</script>

</body>
</html>
`);
});

io.on("connection", socket => {

  socket.on("createRoom", ({ name, mafiaCount, maxPlayers }) => {
    const code = makeCode();

    rooms[code] = {
      host: socket.id,
      players: [],
      roles: {},
      mafiaCount,
      maxPlayers
    };

    socket.join(code);
    rooms[code].players.push({ id: socket.id, name });

    socket.emit("roomCode", code);
    io.to(code).emit("players", rooms[code].players);
  });

  socket.on("joinRoom", ({ name, code }) => {
    let room = rooms[code];

    if (!room) {
      socket.emit("errorMsg", "Room not found ❌");
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      socket.emit("errorMsg", "Room full 🚫");
      return;
    }

    socket.join(code);
    room.players.push({ id: socket.id, name });

    io.to(code).emit("players", room.players);
  });

  socket.on("startGame", (code) => {
    let room = rooms[code];
    if (!room) return;

    if (room.players.length < room.maxPlayers) {
      io.to(room.host).emit("errorMsg", "Players not full ❌");
      return;
    }

    let shuffled = [...room.players].sort(() => Math.random() - 0.5);

    room.roles = {};

    for (let i = 0; i < room.mafiaCount; i++) {
      if (shuffled[i]) room.roles[shuffled[i].id] = "Mafia";
    }

    if (shuffled[room.mafiaCount]) {
      room.roles[shuffled[room.mafiaCount].id] = "Doctor";
    }

    shuffled.forEach(p=>{
      if (!room.roles[p.id]) room.roles[p.id] = "Villager";
    });

    room.players.forEach(p=>{
      io.to(p.id).emit("role", room.roles[p.id]);
    });

    let list = room.players.map(p=>{
      return { name: p.name, role: room.roles[p.id] };
    });

    io.to(room.host).emit("hostRoles", list);
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log("Running on " + PORT));
