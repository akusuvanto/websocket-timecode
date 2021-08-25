const express = require('express');
const path = require('path');
const http = require('http')
const WebSocket = require('ws');

const httpPort = 8080;
const port = 5000;

// null object for ping
function noop() {}

function heartbeat() {
    this.isAlive = true;
    console.log("received pong!")
}

const server = http.createServer(express);
const wss = new WebSocket.Server({server});
const app = express();

wss.on('connection', function connection(ws){
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    ws.startTime = Date.now();
})

function sendTimecode() {
    wss.clients.forEach(function each(ws) {
        ws.send(msToTimecode(Date.now() - ws.startTime).toString())
    });
};

const pingInterval = setInterval(function ping() {

    // Tracking amount of active connections
    let connection_number = 0;
    
    wss.clients.forEach(function each(ws) {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping(noop);
        connection_number++;
    });
    console.log(connection_number.toString() + " Connections active!")
}, 5000);

// Convert milliseconds to timecode format
function msToTimecode(ms) {
    var milliseconds = ms % 1000;
    s = (ms - milliseconds) / 1000;
    var seconds = s % 60;
    m = (s - seconds) / 60;
    var minutes = m % 60;
    var hours = (m - minutes) / 60;

    return  pad(hours) + ":" + 
            pad(minutes) + ":" + 
            pad(seconds) + "." + 
            pad(milliseconds, 3)
}

// Pad numbers to at least 'accuracy' digits
function pad(number, accuracy=2) {
    cut_len = Math.max(number.toString().length, accuracy);
    return ('00' + number).slice(-cut_len);
}

wss.on('close', function close() {
    clearInterval(pingInterval);
    console.log("Websocket Server Closed");
});

// Routing
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'))
});

// Start timecode Loop
setInterval(sendTimecode, 1);

// Listen
app.listen(httpPort);

server.listen(port, function() {
    console.log(`HTTP Server listening on port ${httpPort}`)
    console.log(`Websocket Server listening on port ${port}`)
})