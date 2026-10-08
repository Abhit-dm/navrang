require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: process.env.MAX_BODY_SIZE || '100kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'Navrang Tyres API' }));
app.use('/api/public', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/employees'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/products', require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/warranties', require('./routes/warranties'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/search', require('./routes/search'));
app.use('/api/enquiries', require('./routes/enquiries'));

app.use((req, res) => res.status(404).json({ error: 'Not Found', message: 'The requested resource was not found.' }));
app.use(errorHandler);

module.exports = app;
