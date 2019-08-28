#!/usr/bin/env node
/***/
'use strict';

var currentNodeVersion = process.versions.node;
var semer = currentNodeVersion.split('.');
var major = semer[0];

if (major < 8) {
    console.error('当前node 版本' + currentNodeVersion + '太低，请将node升级到8.0以上版本')
    process.exit(1);
}

require('./createApp.js');
