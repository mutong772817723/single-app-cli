#!/usr/bin/env node
/***/
'use strict';
/**版本格式化和计算的库   https://www.npmjs.com/package/semver */
const semver = require('semver');

var currentNodeVersion = process.versions.node;

/**判断当前nodejs版本是否大于8.10.0,如果小于，则使用react-scripts@0.9.x */
if (!semver.satisfies(currentNodeVersion, '>=8.10.0')) {
    console.error('当前node 版本' + currentNodeVersion + '太低，请将node升级到8.10.0以上版本')
    process.exit(1);
}

require('./createApp.js');
