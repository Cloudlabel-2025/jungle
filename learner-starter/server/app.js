import express from 'express';
export function createApp(){const app=express();app.disable('x-powered-by');app.use(express.json({limit:'100kb'}));app.get('/health',(_req,res)=>res.json({status:'starter',implemented:false}));
 // TODO: implement the approved API, data model, validation, authentication and tests.
 // Requests fail visibly until the learner implements them; this is not a sample solution.
 app.use('/api',(_req,res)=>res.status(501).json({error:'Assigned learner implementation is pending.'}));return app;}
