const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const messages = [];

app.get('/', (req, res) => {
    res.send('Swemessage Server is running!');
});

app.get('/api/messages', (req, res) => {
    res.json(messages);
});

app.post('/api/messages', (req, res) => {
    const { sender, text } = req.body;
    if (!sender || !text) return res.status(400).json({ error: 'Нет данных' });
    
    const newMessage = { sender, text, time: new Date() };
    messages.push(newMessage);
    io.emit('new_message', newMessage);
    res.json(newMessage);
});

io.on('connection', (socket) => {
    console.log('Пользователь подключился');
    
    socket.on('send_message', (data) => {
        const newMessage = { sender: data.sender, text: data.text, time: new Date() };
        messages.push(newMessage);
        io.emit('new_message', newMessage);
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключился');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
