require('dotenv').config();
let terminalSession = null;
const fs = require('fs');
const http = require('http');
const repl = require('repl');
const express = require('express');
const server = express();
const path = require('path');
const users = require('./User');
const code = require('./Code');
const UtilClass = require('../util/Util');
const { spawn } = require('child_process');
const ErrorResponse = require('../model/response/ErrorResponse');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const codeServer = http.createServer(server);
const socketCode = require('socket.io')(codeServer);

/**
 * Express middleware
 *
 * @author Guilherme da Silva Martin
 */
server.use(cookieParser());
server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: true }));
server.use(express.static(path.resolve(__dirname + '/../../Front-end/')));
server.use(express.static(path.resolve(__dirname + '/../../node_modules/')));
server.use(users);
server.use(code);

/**
 * CORS Control
 *
 * @author Guilherme da Silva Martin
 */
server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://rtcode.me');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

/**
 * Error handler
 *
 * @author Guilherme da Silva Martin
 */
server.use((err, req, res, next) => {
  if (!UtilClass.isNullOrEmpty(err.statusCode)) {
    res.status(err.statusCode).json(new ErrorResponse(err.statusCode, err.message, err.stack));
  } else {
    res.status(500).json(new ErrorResponse(500, err.message, null));
  }

  next();
});

/**
 * Redirect user to coding page.
 *
 * @author Guilherme da Silva Martin
 */
server.get('/code/:codeid?', (req, res) => {
  res.sendFile(path.resolve(__dirname + '/../../Front-end/code.html'));
});

/**
 * Function performed when there is a new socket connection.
 *
 * @author Guilherme da Silva Martin
 */
socketCode.on('connection', (socket) => {
  socket.on('join-code', (room) => {
    socket.leaveAll();
    socket.join(room);
  });

  socket.on('code-change', (evt) => {
    socket.to(evt[0]).emit('code-change', evt[1]);
  });

  socket.on('term-cmd', (evt) => {
    if (terminalSession === null) {
      return (terminalSession = spawn(evt, ['-i']));
    }

    terminalSession.stdin.setEncoding('utf8');
    terminalSession.stdout.setEncoding('utf8');
    terminalSession.stderr.setEncoding('utf8');

    terminalSession.stdin.write(evt + '\n');

    terminalSession.stdout.on('data', (data) => {
      socket.emit('term-response', data);
    });

    terminalSession.stderr.on('data', (data) => {
      socket.emit('term-response', data);
    });

    terminalSession.on('error', (error) => {
      socket.emit('term-response', error.message);
    });

    terminalSession.on('close', (codeNum) => {
      socket.emit('term-response', `child process exited with code ${codeNum}`);
    });
  });
});

/**
 * Server port listener.
 *
 * @author Guilherme da Silva Martin
 */
codeServer.listen(5000);
