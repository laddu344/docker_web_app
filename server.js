'use strict';

const express = require('express');

// Use PORT from environment variable, default to 3000
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const app = express();

// Main route
app.get('/', (req, res) => {
    res.send('Hello World from NodeJS App on EKS ✅');
});

// Health check endpoints for Kubernetes
app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

app.get('/ready', (req, res) => {
    res.status(200).send('Ready');
});

// Start server
app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
});
