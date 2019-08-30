// const semver = require('semver');
// const v = semver.satisfies(process.versions.node, '>=8.10.0')


const path = require('path');
console.log(path.dirname(path.join(__dirname, '..', 'package.json')));
console.log(path.dirname(path.join(__dirname, 'react-init-script')));
console.log(require.resolve(path.join(__dirname, 'package.json')));
console.log(__dirname);