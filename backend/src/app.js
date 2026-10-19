const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./modules/auth/auth.routes');
const errorHandler = require('./middleware/errorHandler');
const memberRoutes = require('./modules/members/members.routes');
const membershipsRoutes=require('./modules/memberships/memberships.routes');
const paymentRoutes=require('./modules/payments/payments.routes');
const attendanceRoutes=require('./modules/attendance/attendance.routes');
const enquiriesRoutes=require('./modules/enquiries/enquiries.routes');
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/members', memberRoutes);
app.use('/api/v1/memberships', membershipsRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/enquiries', enquiriesRoutes);
app.use(errorHandler);

module.exports = app;