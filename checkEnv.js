require('dotenv').config();

// env 
console.log('FB_SERVICE_KEY exists?', !!process.env.FB_SERVICE_KEY);
console.log('First 40 chars:', (process.env.FB_SERVICE_KEY || '').slice(0, 40));
