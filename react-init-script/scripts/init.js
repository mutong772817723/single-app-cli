'use strict';

/**
 * 观看入口：module.exports
 * 从createApp页面是通过var init=require('react-scripts/scripts/init.js')来访问的
 * 得到的init是 module.exports出去的function
 * 然后通过apply 将参数[root, appName, verbose, originalDirectory, template] 穿了进来
 */

const path = require('path');

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
    //获取react-scripts文件夹
    const ownPath = path.dirname(__dirname);
    //初始化项目的配置文件
    const appPackage = require(path.join(appPath, 'package.json'));
    //如果通过yarn安装的依赖包，会生成yarn.lock文件
    const useYarn = fs.existsSync(path.join(appPath, 'yarn.lock'));

    /**
     * 如果依赖项没有创建，则初始化，
     * TIP：其实如果依赖包下载成功，这个项不会为空，见 createApp.js 的 setCaretRangeForRuntimeDeps方法
     * */ 
    appPackage.dependencies = appPackage.dependencies || {};



}