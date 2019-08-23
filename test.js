
const spawn = require('cross-spawn');
const path = require('path');
const data = JSON.stringify([path.resolve('index'),'index']);
console.log(data);
console.log(path.resolve('demo1'));
spawn(process.execPath, ['--', path.resolve('index'),'index'], { cwd: process.cwd(), stdio: 'inherit' })
    .on('close', (code, sig) => {
        console.log(code);
    })
