const http = require('http');
const fs = require('fs');
const url = require('url');
const EventEmitter = require('events');
const path = require('path');

const PORT = 3000;
const TODOS_FILE = path.join(__dirname, 'todos.json');
const LOG_FILE = path.join(__dirname, 'logs.txt');

// Logger
class Logger extends EventEmitter {}
const logger = new Logger();
logger.on('log', (msg) => {
  const log = `${new Date().toISOString()} - ${msg}\n`;
  fs.appendFile(LOG_FILE, log, err => {
    if (err) console.error('Logging error:', err);
  });
});

// Helper functions
const readTodos = () =>
  new Promise((resolve, reject) =>
    fs.readFile(TODOS_FILE, 'utf-8', (err, data) =>
      err ? reject(err) : resolve(JSON.parse(data))
    )
  );

const writeTodos = (data) =>
  new Promise((resolve, reject) =>
    fs.writeFile(TODOS_FILE, JSON.stringify(data, null, 2), err =>
      err ? reject(err) : resolve()
    )
  );

// Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const method = req.method;
  const pathname = parsedUrl.pathname;

  logger.emit('log', `${method} ${pathname}`);

  try {
    if (pathname === '/todos' && method === 'GET') {
      let todos = await readTodos();
      const filter = parsedUrl.query.completed;
      if (filter !== undefined) {
        todos = todos.filter(todo => String(todo.completed) === filter);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(todos));
    }

    else if (pathname.match(/^\/todos\/\d+$/) && method === 'GET') {
      const id = parseInt(pathname.split('/')[2]);
      const todos = await readTodos();
      const todo = todos.find(t => t.id === id);
      if (todo) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(todo));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Todo not found' }));
      }
    }

    else if (pathname === '/todos' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const newTodo = JSON.parse(body);
          if (!newTodo.title) {
            res.writeHead(400);
            return res.end(JSON.stringify({ error: 'Title is required' }));
          }
          const todos = await readTodos();
          newTodo.id = todos.length ? todos[todos.length - 1].id + 1 : 1;
          newTodo.completed = newTodo.completed ?? false;
          todos.push(newTodo);
          await writeTodos(todos);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(newTodo));
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    }

    else if (pathname.match(/^\/todos\/\d+$/) && method === 'PUT') {
      const id = parseInt(pathname.split('/')[2]);
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const updated = JSON.parse(body);
          const todos = await readTodos();
          const index = todos.findIndex(t => t.id === id);
          if (index === -1) {
            res.writeHead(404);
            return res.end(JSON.stringify({ error: 'Todo not found' }));
          }
          todos[index] = { ...todos[index], ...updated, id };
          await writeTodos(todos);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(todos[index]));
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    }

    else if (pathname.match(/^\/todos\/\d+$/) && method === 'DELETE') {
      const id = parseInt(pathname.split('/')[2]);
      const todos = await readTodos();
      const index = todos.findIndex(t => t.id === id);
      if (index === -1) {
        res.writeHead(404);
        return res.end(JSON.stringify({ error: 'Todo not found' }));
      }
      const deleted = todos.splice(index, 1);
      await writeTodos(todos);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(deleted[0]));
    }

    else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
