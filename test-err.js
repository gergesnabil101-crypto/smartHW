const express = require('express');
const app = express();
app.use(express.json({limit: '10b'}));
app.post('/test', (req, res) => res.json({ok:true}));
app.use('/api', (req, res) => res.status(404).json({error: '404'}));
app.use((err, req, res, next) => res.status(500).json({error: '500'}));
app.listen(3001, () => console.log('started'));
