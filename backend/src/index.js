const { validateEnvironment } = require('./config/environment');
const app = require('./app');

validateEnvironment();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`NAVRANG TYRES API running on http://localhost:${PORT}`);
});
