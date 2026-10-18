const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./modules/auth/auth.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));
app.use('/api/v1/auth', authRoutes);

app.use(errorHandler);

module.exports = app;