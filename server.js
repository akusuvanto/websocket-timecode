const express = require('express');
const path = require('path');
const http = require('http')
const WebSocket = require('ws');
const clear = require('console-clear');

const httpPort = 8080;
const port = 5000;

var lastPongTime;
var numActiveConnections = 0;
var masterStartTime = Date.now();

// null object for ping
function noop() {}

function heartbeat() {
    this.isAlive = true;
    lastPongTime = Date.now();
}

const server = http.createServer(express);
const wss = new WebSocket.Server({server});
const app = express();

wss.on('connection', function connection(ws){
    ws.isAlive = true;
    ws.localStartTime = Date.now();
    ws.startTime = masterStartTime;
    ws.on('pong', heartbeat);

    // Modes: milliseconds, formatted
    ws.timeMode = 'milliseconds';
})

// Command handler
wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        switch(message.toString()) {
            case 'restart local':
                ws.localStartTime = Date.now();
                ws.startTime = ws.localStartTime;
                break;

            case 'restart master':
                oldMasterStartTime = masterStartTime;
                masterStartTime = Date.now();
                wss.clients.forEach(function each(ws) {
                    if (ws.startTime == oldMasterStartTime){
                        ws.startTime = masterStartTime;
                    }
                });
                break;

            case 'switch local':
                ws.startTime = ws.localStartTime;
                break;

            case 'switch master':
                ws.startTime = masterStartTime;
                break;

            case 'timemode milliseconds':
                ws.timeMode = 'milliseconds'
                break;

            case 'timemode formatted':
                ws.timeMode = 'formatted'
                break;

            default:
                break;
        }
    });
});

function sendTimecode() {
    wss.clients.forEach(function each(ws) {
        switch(ws.timeMode) {
            case 'milliseconds':
                ws.send((Date.now() - ws.startTime).toString())
                break;
            case 'formatted':
                ws.send(msToTimecode(Date.now() - ws.startTime).toString())
                break;
            default:
                break;
        }
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
    numActiveConnections = connection_number;
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

function drawCLI(){
    clear();
    console.log("------------------------------")
    console.log(numActiveConnections + " Connections active")
    console.log("Last pong: " + Math.floor((Date.now() - lastPongTime)/1000) + " seconds ago")
    console.log("------------------------------")
}

setInterval(function(){ drawCLI(); }, 1000);

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