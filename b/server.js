const path = require('path');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const io = new Server(app, { cors: { origin: '*' } });
const rooms = new Map();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'outputs')));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'outputs', 'neon-rift.html')));
app.get('/health', (_, res) => res.json({ ok: true, rooms: rooms.size }));

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return rooms.has(code) ? makeCode() : code;
}
function publicRoom(room) {
  return { code: room.code, players: [...room.players.values()] };
}
function leaveRoom(socket) {
  const code = socket.data.room;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  socket.data.room = null;
  if (!room) return;
  room.players.delete(socket.id);
  if (room.players.size === 0) rooms.delete(code);
  else io.to(code).emit('room-state', publicRoom(room));
}
function joinRoom(socket, code, skin) {
  leaveRoom(socket);
  let room = rooms.get(code);
  if (!room) { room = { code, players: new Map() }; rooms.set(code, room); }
  if (room.players.size >= 4) return socket.emit('room-error', 'Bu oda dolu.');
  socket.join(code); socket.data.room = code;
  room.players.set(socket.id, { id: socket.id, x: 0, y: 0, angle: 0, skin: skin || 'cyan', score: 0 });
  socket.emit('room-joined', { code, self: socket.id });
  io.to(code).emit('room-state', publicRoom(room));
}

io.on('connection', socket => {
  socket.on('create-room', ({ skin } = {}) => joinRoom(socket, makeCode(), skin));
  socket.on('join-room', ({ code, skin } = {}) => {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) return socket.emit('room-error', '5 haneli oda kodu gir.');
    joinRoom(socket, code, skin);
  });
  socket.on('player-state', state => {
    const room = rooms.get(socket.data.room); const player = room?.players.get(socket.id);
    if (!player || !state) return;
    player.x = Number(state.x) || 0; player.y = Number(state.y) || 0;
    player.angle = Number(state.angle) || 0; player.score = Math.max(0, Number(state.score) || 0);
    player.skin = typeof state.skin === 'string' ? state.skin.slice(0, 20) : player.skin;
    socket.to(room.code).emit('player-state', player);
  });
  socket.on('leave-room', () => leaveRoom(socket));
  socket.on('disconnect', () => leaveRoom(socket));
});

app.listen(PORT, () => console.log(`NEON RIFT online server listening on :${PORT}`));
