import {createApp} from './app.js';
const port=Number(process.env.PORT||4100);createApp().listen(port,'127.0.0.1',()=>console.log(`Learner starter: http://127.0.0.1:${port}; API tasks are deliberately unimplemented.`));
