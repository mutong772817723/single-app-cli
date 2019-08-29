'use strict';

/**
 * 观看入口：module.exports
 * 从createApp页面是通过var init=require('react-scripts/scripts/init.js')来访问的
 * 得到的init是 module.exports出去的function
 * 然后通过apply 将参数[root, appName, verbose, originalDirectory, template] 穿了进来
 */

/**
 * 监听异常，捕获到之后直接终止进程，
 * promise如果异常并且没有被catch接收的异常会被捕获
 */
process.on('unhandledRejection', err => {
    throw err;
})

/**
* 从createApp页面是通过var init=require('react-scripts/scripts/init.js')来访问的
 * 得到的init是 module.exports出去的function
 * 然后通过apply 将参数[root, appName, verbose, originalDirectory, template] 穿了进来 
 * appPath:项目根目录
 * appName；项目名称
 * verbose：是否展示详情
 * originalDirectory：nodejs执行目录
 * template：模板
 */
module.exports = function (
    appPath,
    appName,
    verbose,
    originalDirectory,
    template
) {
    console.log('init');
}