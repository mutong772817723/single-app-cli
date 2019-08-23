#!/usr/bin/env node
/**
 * 
 * 
 * 注意：
 * 命令中：yarn 等同于 yarnpkg
 * process.exit(code)  code默认0， 0:正常退出，1:错误退出 
 */
'use strict';
const path = require('path');

/** nodejs命令行的完整解决方案，借鉴于ruby的commander   https://www.npmjs.com/package/commander*/
const commander = require('commander');

/**输出环境信息 https://www.npmjs.com/package/envinfo */
const envinfo = require('envinfo');
/* 定制输出字体颜色*/
const chalk = require('chalk');

/* fs的扩展库*/
const fs = require('fs-extra');

/**版本格式化和计算的库   https://www.npmjs.com/package/semver */
const semver = require('semver');

/** 交互式命令行工具 https://www.npmjs.com/package/inquirer  资料：https://www.jianshu.com/p/db8294cfa2f7 */
const inquirer = require('inquirer');

/** 用户临时文件资源的管理，在这里用 tmp-promise 代替   //https://www.npmjs.com/package/tmp   */
// const tmp = require('tmp');

/** 用来替代tmp功能  来做promise调用，tmp-promise :https://github.com/benjamingr/tmp-promise */
const tmpPromise = require('tmp-promise');

/** 将http请求转化为流输出 https://www.npmjs.com/package/hyperquest*/
const hyperquest = require('hyperquest');

/**压缩和解压  https://www.npmjs.com/package/tar-pack */
const unpack = require('tar-pack').unpack;

/**nodejs  spawn / spawnSync 的解决方案 https://www.npmjs.com/package/cross-spawn */
const spawn = require('cross-spawn');

/**检查package的name是否合法 */
const validateProjectName = require('validate-npm-package-name');

/** 在这里主要用到换行符 os.EOL*/
const os = require('os');

/** dns相关的api*/
const dns = require('dns');

/**url相关 */
const url = require('url');

const execSync = require('child_process').execSync;

const packageJson = require('./package.json');

/**在创建失败时保留，在新建时删除 */
const errorLogFilePatterns = [
    'npm-debug.log',
    'yarn-error.log',
    'yarn-debug.log',
];

var currentNodeVersion = process.versions.node;
var semer = currentNodeVersion.split('.');
var major = semer[0];
if (major < 8) {
    console.error('当前node 版本' + currentNodeVersion + '太低，请将node升级到8.0以上版本')
    process.exit(1);
}


let projectName;
const program = new commander.Command(packageJson.name)  //命令名
    .version(packageJson.version)
    .arguments('<project-directory>')
    .usage(`${chalk.green('<project-directory>')} [options]`)
    .action(name => {
        projectName = name;
    })
    .option('--verbose', 'print additional logs')
    .option('--info', 'print environment debug info')
    .option(
        '--scripts-version <alternative-package>',
        'use a non-standard version of react-scripts'
    )
    .option('--use-npm')
    .option('--use-pnp')
    .option('--typescript')
    .allowUnknownOption()
    .on('--help', () => {
    })
    .parse(process.argv);

//如果键入 --info  输出信息
if (program.info) {
    envinfo
        .run(
            {
                System: ['OS', 'CPU'],
                Binaries: ['Node', 'npm', 'Yarn'],
                Browsers: ['Chrome', 'Edge', 'Internet Explorer', 'Firefox', 'Safari'],
                npmPackages: ['react', 'react-dom', 'react-scripts'],
                npmGlobalPackages: ['create-react-app'],
            },
            {
                duplicates: true,
                showNotFound: true,
            }
        )
        .then(console.log);
}

if (typeof projectName === 'undefined') {
    console.log(`${chalk.red('请键入项目文件夹名称')}`)
    process.exit(1);
}

const hiddenProgram = new commander.Command()
    .option(
        '--internal-testing-template <path-to-template>',
        '(internal usage only, DO NOT RELY ON THIS) ' +
        'use a non-standard application template'
    )
    .parse(process.argv);


createApp(
    projectName,
    program.verbose,
    program.scriptsVersion,
    program.useNpm,
    program.usePnp,
    program.typescript,
    hiddenProgram.internalTestingTemplate
);

/**创建app */
function createApp(
    name,
    verbose,
    version,
    useNpm,
    usePnp,
    useTypescript,
    template
) {
    const root = path.resolve(name);
    const appName = path.basename(root);

    /**
     * 检验应用名的合法性
     * */
    checkAppName(appName)

    //创建根目录
    fs.ensureDirSync(root);

    /**
     * 判断是否可以安全的创建项目
     */
    if (!isSafeToCreateProjectIn(root, name)) {
        process.exit(1);
    }

    console.log(`Create a new react app in ${chalk.green(root)}.`);
    console.log();
    //初始package配置
    const packageJson = {
        name: appName,
        version: '0.1.0',
        private: true
    }
    //写入基本配置项，   os.EOL  换行符
    fs.writeFileSync(path.resolve(root, 'package.json'), JSON.stringify(packageJson, null, 2) + os.EOL);

    /**判断使用 yarn 还是 npm */
    const useYarn = useNpm ? false : shouldUseYarn();

    //获取nodejs执行的目录
    const originalDirectory = process.cwd();
    //变更nodejs执行目录
    process.chdir(root);

    //如果不能使用yarn 或 npm  退出
    if (!useYarn && !checkThatNpmCanReadCwd()) {
        process.exit(1);
    }
    /**判断当前nodejs版本是否大于8.10.0,如果小于，则使用react-scripts@0.9.x */
    if (!semver.satisfies(process.version, '>=8.10.0')) {
        console.log(
            chalk.yellow(
                `你当前使用的nodejs版本 ${
                process.version
                } 过低，所以该项目将会使用较旧版本的工具来进行引导安装。\n\n` +
                `如果想要等到更高更完整的支持和体验，请升级nodejs到8.10.0或者更高的版本\n`
            )
        );
        // Fall back to latest supported react-scripts on Node 4
        version = 'react-scripts@0.9.x';
    }

    /**如果不实用yarn，即调用npm */
    if (!useYarn) {
        const npmInfo = checkNpmVersion();
        //如果npm的版本低于5.0.0，则使用react-scripts@0.9.x来进行引导安装
        if (!npmInfo.hasMinNpm) {
            if (npmInfo.npmVersion) {
                console.log(
                    chalk.yellow(
                        `你是用的npm版本 ${npmInfo.npmVersion}过低，所以项目只能使用较旧的工具进行引导安装.\n\n` +
                        `如果想要等到更高更完整的支持和体验，请升级npm到5及以上版本。\n`
                    )
                );
            }
            version = 'react-scripts@0.9.x';
        }
    }//该逻辑为是否开启yarn的pnp特性，pnp的好处可参考文献：https://loveky.github.io/2019/02/11/yarn-pnp/ 
    else if (usePnp) {
        const yarnInfo = checkYarnVersion();
        if (!yarnInfo.hasMinYarnPnp) {
            if (yarnInfo.yarnVersion) {
                console.log(
                    chalk.yellow(
                        `你是用的yarn版本 ${yarninfo.yarnVersion}过低，无法配合Plug'n'Play（pnp） 使用.\n\n` +
                        `如果想要等到更高更完整的支持和体验，请将yarn升级到1.12及以上版本。\n`
                    )
                );
            }
            usePnp = false;
        }
    }

    /**缓存依赖的版本信息，参考资料：https://yarnpkg.com/blog/2016/11/24/offline-mirror/ */
    if (useYarn) {
        let yarnUsesDefaultRegistry = true;
        try {
            //如果yarn的代理地址不是这个，那cache复制过去也没什么用
            yarnUsesDefaultRegistry = execSync('yarn config get registry')
                .toString().trim() === 'https://registry.yarnpkg.com';
        } catch (err) {

        }

        if (yarnUsesDefaultRegistry) {
            fs.copySync(
                require.resolve('./yarn.lock.cached'), //require.resolve(path1)===path.resolve(__dirname,path1),如果路径不存在，还会返回错误
                path.join(root, 'yarn.lock')
            )
        }
    }
    //  启动安装命令
    run(
        root,
        appName,
        version,
        verbose,
        originalDirectory,
        template,
        useYarn,
        usePnp,
        useTypescript
    );

}

/** 打印错误信息 */
function printValidationResults(results) {
    if (typeof results !== 'undefined') {
        results.forEach(error => {
            console.error(chalk.red(`  *  ${error}`));
        });
    }
}

/**检查应用名是否合法 */
function checkAppName(appName) {
    const validationResult = validateProjectName(appName);
    if (!validationResult.validForNewPackages) {
        console.error(
            `Could not create a project called ${chalk.red(
                `"${appName}"`
            )} because of npm naming restrictions:`
        );
        printValidationResults(validationResult.errors);
        printValidationResults(validationResult.warnings);
        process.exit(1);
    }

    // TODO: there should be a single place that holds the dependencies
    const dependencies = ['react', 'react-dom', 'react-scripts'].sort();
    if (dependencies.indexOf(appName) >= 0) {
        console.error(
            chalk.red(
                `We cannot create a project called ${chalk.green(
                    appName
                )} because a dependency with the same name exists.\n` +
                `Due to the way npm works, the following names are not allowed:\n\n`
            ) +
            chalk.cyan(dependencies.map(depName => `  ${depName}`).join('\n')) +
            chalk.red('\n\nPlease choose a different project name.')
        );
        process.exit(1);
    }
}

function isSafeToCreateProjectIn(root, name) {
    const validFiles = [
        '.DS_Store',
        'Thumbs.db',
        '.git',
        '.gitignore',
        '.idea',
        'README.md',
        'LICENSE',
        '.hg',
        '.hgignore',
        '.hgcheck',
        '.npmignore',
        'mkdocs.yml',
        'docs',
        '.travis.yml',
        '.gitlab-ci.yml',
        '.gitattributes',
    ];
    console.log();

    const conflicts = fs
        .readdirSync(root)
        .filter(file => !validFiles.includes(file))
        // IntelliJ IDEA creates module files before CRA is launched
        .filter(file => !/\.iml$/.test(file))
        // Don't treat log files from previous installation as conflicts
        .filter(
            file => !errorLogFilePatterns.some(pattern => file.indexOf(pattern) === 0)
        );

    if (conflicts.length > 0) {
        console.log(
            `The directory ${chalk.green(name)} contains files that could conflict:`
        );
        console.log();
        for (const file of conflicts) {
            console.log(`  ${file}`);
        }
        console.log();
        console.log(
            'Either try using a new directory name, or remove the files listed above.'
        );

        return false;
    }

    // Remove any remnant files from a previous installation
    const currentFiles = fs.readdirSync(path.join(root));
    currentFiles.forEach(file => {
        errorLogFilePatterns.forEach(errorLogFilePattern => {
            // This will catch `(npm-debug|yarn-error|yarn-debug).log*` files
            if (file.indexOf(errorLogFilePattern) === 0) {
                fs.removeSync(path.join(root, file));
            }
        });
    });
    return true;
}
/**判断yarn是否可用   yarnpkg 也可以改为 yarn */
function shouldUseYarn() {
    try {
        execSync('yarnpkg --version', { stdio: 'ignore' })
        return true;
    } catch (e) {
        return false;
    }
}
/**判断当前文件夹是否可以执行npm */
function checkThatNpmCanReadCwd() {
    return true;
}


/**检查npm版本信息 */
function checkNpmVersion() {
    let hasMinNpm = false;
    let npmVersion = null;
    try {
        npmVersion = execSync('npm --version').toString().trim();
        hasMinNpm = semver.gte(npmVersion, '5.0.0');
    }
    catch (err) {

    }
    return {
        hasMinNpm: hasMinNpm,
        npmVersion: npmVersion
    }
}

/**判断yarn的版本信息 */
function checkYarnVersion() {
    let hasMinYarnPnp = false;
    let yarnVersion = null;
    try {
        yarnVersion = execSync('yarn --version').toString().trim(); //yarn  可以用 yarnpkg 代替
        let trimmedYarnVersion = /^(.+?)[-+].+$/.exec(yarnVersion);
        if (trimmedYarnVersion) {
            trimmedYarnVersion = trimmedYarnVersion.pop();// pop 删除数组最后一个元素，并返回
        }
        hasMinYarnPnp = semver.gte(trimmedYarnVersion || yarnVersion, '1.12.0');
    } catch (err) {

    }
    return {
        hasMinYarnPnp: hasMinYarnPnp,
        yarnVersion: yarnVersion
    }
}


function run(
    root,
    appName,
    version,
    verbose,
    originalDirectory,
    template,
    useYarn,
    usePnp,
    useTypescript
) {
    //获取需要安装的package
    getInstallPackage(version, originalDirectory)
        .then(packageToInstall => {
            const allDependencies = ['react', 'react-dom', packageToInstall];
            /**如果用ts语法，还需要安装下面的包 */
            if (useTypescript) {
                allDependencies.push(
                    // TODO: get user's node version instead of installing latest
                    '@types/node',
                    '@types/react',
                    '@types/react-dom',
                    // TODO: get version of Jest being used instead of installing latest
                    '@types/jest',
                    'typescript'
                );
            }
            console.log('开始安装依赖包，这可能需要几分钟的时间');
            /*获取安装包的包名,检查yarn的服务是否通畅*/
            getPackageName(packageToInstall)
                .then(packageName =>
                    checkIfOnline(useYarn)
                        .then(isOnline => ({
                            isOnline: isOnline,
                            packageName: packageName
                        }))
                )
                .then(info => {
                    const isOnline = info.isOnline;
                    const packageName = info.packageName;
                    console.log(
                        `安装 ${chalk.cyan('react')}, ${chalk.cyan(
                            'react-dom'
                        )}, 和 ${chalk.cyan(packageName)}...`
                    );
                    console.log();

                    /**安装所有依赖包 */
                    return install(root, useYarn, usePnp, allDependencies, verbose, isOnline)
                        .then(() => packageName);
                })
                .then(async packageName => {
                    /**检查当前的nodejs版本是否符合依赖包的要求 */
                    checkNodeVersion(packageName);

                    /**设置运行时依赖包[react,react-dom]的大版本锁定，检查react-scripts的版本信息 */
                    setCaretRangeForRuntimeDeps(packageName);

                    const pnpPath = path.join(process.cwd(), '.png.js');
                    const nodeArgs = fs.existsSync(pnpPath) ? ['--require', pnpPath] : [];
                    await executeNodeScript(
                        { cwd: process.cwd(), args: nodeArgs },
                        [root, appName, verbose, originalDirectory, template],
                        `
                        var init = require('${packageName}/scripts/init.js');
                        init.apply(null, JSON.parse(process.argv[1]));
                      `)

                    if (version === 'react-scripts@0.9.x') {
                        //还是一样的信息，不翻译了
                        console.log(
                            chalk.yellow(
                                `\nNote: the project was bootstrapped with an old unsupported version of tools.\n` +
                                `Please update to Node >=8.10 and npm >=5 to get supported tools in new projects.\n`
                            )
                        );
                    }


                })
                .catch(reason => {
                    console.log();
                    console.log('Aborting installation.');
                    if (reason.command) {
                        console.log(`  ${chalk.cyan(reason.command)} has failed.`);
                    } else {
                        console.log(
                            chalk.red('Unexpected error. Please report it as a bug:')
                        );
                        console.log(reason);
                    }
                    console.log();

                    /**失败退出时删除相应的文件 */
                    const knownGeneratedFiles = [
                        'package.json',
                        'yarn.lock',
                        'node_modules',
                    ];

                    const currentFiles = fs.readdirSync(path.join(root));

                    currentFiles.forEach(file => {
                        knownGeneratedFiles.forEach(fileToMatch => {
                            if (file === fileToMatch) {
                                console.log('正在删除生成的文件...')
                                fs.removeSync(path.join(root, file));
                            }
                        })
                    })

                    const remainingFiles = fs.readdirSync(path.join(root));
                    /**如果没文件了，就删除文件夹，如果还有其他文件，不做操作，以防止误删，或权限问题 */
                    if (!remainingFiles.length) {
                        console.log(
                            `Deleting ${chalk.cyan(`${appName}/`)} from ${chalk.cyan(
                                path.resolve(root, '..')
                            )}`
                        );
                        process.chdir(path.resolve(root, '..'));
                        fs.rmdirSync(path.join(root));
                    }
                    console.log('删除操作完毕');
                    process.exit(0);
                })
        })

}

/**将包名和版本号做拼接 */
function getInstallPackage(version, originalDirectory) {
    let packageToInstall = 'react-scripts';
    //先格式化版本信息，不合格返回null
    const validSemver = semver.valid(version);
    if (validSemver) {
        //标准版本号
        packageToInstall += `@${validSemver}`
    } else if (version) {
        //不标准版本号
        if (version[0] === '@' && version.indexOf('/') === -1) {
            packageToInstall += version;
        } else if (version.match(/^file:/)) {
            //文件
            packageToInstall = `file:${path.resolve(
                originalDirectory,
                version.match(/^file:(.*)?$/)[1]
            )}`;
        } else {
            // 针对tar.gz及可选路径
            packageToInstall = version;
        }
    }

    const scriptsToWarn = [
        {
            name: 'react-scripts-ts',
            message: chalk.yellow(
                'react-scripts-ts包已经被废弃. 新建的React项目中已经可以支持TypeScript原生语法. 你可以用 --typescriptwhen 来生成支持Typescript语法的app，还想继续使用react-scripts-ts吗?'
            ),
        },
    ];

    /**这一段判断感觉有些多余，永远是false */
    for (const script of scriptsToWarn) {
        if (packageToInstall.startsWith(script.name)) {
            inquirer
                .prompt({
                    type: 'confirm',
                    name: 'useScript',
                    message: script.message,
                    default: false,
                })
                .then(answer => {
                    if (!answer.useScript) {
                        process.exit(0);
                    }
                    return packageToInstall;
                })
        }
    }

    return Promise.resolve(packageToInstall);

}


/**获取依赖包的包名 
 * 1.先做文件解压，通过package.json来获取包名
 * 2.文件解压失败，通过路径正则匹配来获取包名，
 * 可以用这个包名来做下面的正则测试：https://registry.yarnpkg.com/@babel/helper-simple-access/-/helper-simple-access-7.1.0.tgz
*/
function getPackageName(installPackage) {
    //判断是否为资源文件压缩包
    if (installPackage.match(/^.+\.(tgz|tar\.gz)$/)) {
        //创建临时文件夹来存放包文件
        getTemporaryDirectory()
            .then(obj => {
                let stream;
                if (/^http/.test(installPackage)) {
                    stream = hyperquest(installPackage);
                } else {
                    stream = fs.createReadStream(installPackage);
                }
                return extractStream(stream, obj.tmpdir)
                    .then(() => obj)

            })
            .then(obj => {
                const packageName = require(path.join(obj.tmpdir, 'package.json')).name;
                obj.cleanup();
                console.log(packageName);
                return packageName;
            })
            .catch(err => {
                console.log(
                    `无法通过解压文件来获取包名，错误为: ${err.message}`
                );
                const assumedProjectName = installPackage.match(/^.+\/(.+?)(?:-\d+.+)?\.(tgz|tar\.gz)$/)[1];
                console.log(
                    `通过文件名，我们推算出包名为：${chalk.cyan(
                        assumedProjectName
                    )}"`
                );
                return Promise.resolve(assumedProjectName);
            })
    }
}


/**创建和获取临时文件夹，进程退出后会被自动清理调,
 * 原包用的tmp，在这里我替换成了tmp-promise */
function getTemporaryDirectory() {
    return tmpPromise.dir({ unsafeCleanup: true })
        .then(o => (
            {
                tmpdir: o.path,
                cleanup: () => {
                    try {
                        o.cleanup()
                    } catch (err) {

                    }
                }
            }
        ))
}

/**解压文件流到文件夹下 */
function extractStream(stream, dest) {
    return new Promise((resolve, reject) => {
        stream.pipe(
            unpack(dest, err => {
                if (err) {
                    return reject(err);
                }
                resolve(dest);
            })
        )
    })
}

/**检查yarn是否在线，ping一下yarn的主机，有代理就ping代理的主机 */
function checkIfOnline(useYarn) {
    if (!useYarn) {
        return Promise.resolve(true);
    }

    return new Promise(resolve => {
        dns.lookup('registry.yarnpkg.com', err => {
            let proxy;
            if (err && (proxy = getProxy())) {
                dns.lookup(url.parse(proxy).hostname, err => {
                    resolve(err == null);
                })
            }
            else {
                resolve(err == null);
            }
        })
    })
}

/**获取代理信息 */
function getProxy() {
    if (process.env.https_proxy) {
        return process.env.https_proxy;
    } else {
        try {
            let httpsProxy = process.execSync('npm config get https-proxy').toString().trim();
            return httpsProxy !== 'null' ? httpsProxy : undefined;
        }
        catch (err) {
            return;
        }
    }
}

/**安装依赖包
 * root 项目文件夹
 * useYarn 是否使用yarn
 * usePnp 是否使用pnp特性
 * dependencies 依赖
 * verbose  详细信息输出
 * isOnline 是否正常请求yarn服务
 */
function install(root, useYarn, usePnp, dependencies, verbose, isOnline) {
    return new Promise((resolve, reject) => {
        let command;
        let args;
        if (useYarn) {
            command = 'yarnpkg';
            args = ['add', '--exact'];

            if (!isOnline) {
                args.push('--offline');
            }
            if (usePnp) {
                args.push('--enable-pnp');
            }

            /**兼容性好 */
            [].push.apply(args, dependencies);

            /**将nodejs的工作进程指定到当前目录，
             * 这样做是为了解决下面这个bug 
             * https://github.com/facebook/create-react-app/issues/3326.
             * */
            args.push('--cwd');
            args.push(root);

            if (!isOnline) {
                console.log(chalk.yellow('你好像掉线了'));
                console.log(chalk.yellow('我们将使用本地的yarn缓存来安装'));
                console.log();
            }
        }
        else {
            command = 'npm';
            args = [
                'install',
                '--save',
                '--save-exact', //精确安装指定版本
                '--loglevel',
                'error',
            ].concat(dependencies);

            if (usePnp) {
                console.log(chalk.yellow("NPM 不支持 PnP."));
                console.log(chalk.yellow('我们将会使用常规方式继续安装'));
                console.log();
            }
        }

        if (verbose) {
            args.push('--verbose');
        }

        /**stdio:选项用于配置在父进程和子进程之间建立的管道,设置为inherit则会继承父进程的输入输出流 */
        const child = spawn(command, args, { stdio: 'inherit' });
        child.on('close', code => {
            if (code !== 0) {
                reject({ command: `${command} ${args.join(' ')}` })
                return;
            }
            resolve();
        });
    });
}

/**检测node版本是否相合，
 * 依赖包的package.json中的node版本和本地运行的node 版本做比较*/
function checkNodeVersion(packageName) {
    const packageJsonPath = path.resolve(process.cwd(), 'node_modules', packageName, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        return;
    }

    const packageJson = require(packageJsonPath);
    if (!packageJson.engines || !packageJson.engines.node) {
        return;
    }
    const range = packageJson.engines.node;
    if (!semver.satisfies(process.version, range)) {
        console.error('您当前的node版本为:%s,创建一个react应用需要%s或者更高的版本,请更新你的node版本', process.version, range);
        process.exit(1);
    }


}

/**
 * 补充锁定运行时依赖包的大版本信息，
 * 检查依赖包的版本号信息是否正常
 */
function setCaretRangeForRuntimeDeps(packageName) {
    let packagePath = path.join(process.cwd(), 'package.json');
    let packageJson = require(packagePath);
    if (typeof packageJson.dependencies === 'undefined') {
        console.error(`${chalk.red('无法在package.json中找到依赖包配置')}`);
        process.exit(1);
    }

    if (typeof packageJson.dependencies[packageName] === 'undefined') {
        console.error(chalk.red(`无法找到${packageName}配置项`));
        process.exit(1);
    }

    makeCaretRange(packageJson.dependencies, 'react');
    makeCaretRange(packageJson.dependencies, 'react-dom');

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + os.EOL);
}


/**补充版本号信息，就是追加一个^，用于锁定大版本信息不可被修改 */
function makeCaretRange(dependencies, name) {
    const version = dependencies[name];
    if (typeof version === 'undefined') {
        console.error(chalk.red(`package.json中缺少${name}包的依赖`));
        process.exit(1);
    }
    let patchedVersion = `^${version}`;
    //检查填充完的版本号信息是否合法
    if (!semver.validRange(patchedVersion)) {
        console.error(chalk.red(`包${name}的版本号${version}无法进行补充，因为，补充完之后的版本号${patchedVersion}会变得不可用`));
        patchedVersion = version;
    }
    dependencies[name] = patchedVersion;

}

/**
 * cwd:当前工作目录
 * args:参数
 * data
 * source 执行的一段js
 * 
 * spawn中参数含义：
 * process.execPath 当前可执行程序：...path/node.exe
 * ...args 业务配置参数 --require .pnp.js
 * -e stirng :-e, --eval "script" 执行一段js，比如 -e ‘console.log("hello node")'
 * -- JSON.stringify(data)  -- [path.resolve(projectName),projectName,--verbose,...]
 * {cwd,stdio}  cwd：将路径定位到的目录，这样arg的js访问路径可以写成相对的。
 */
function executeNodeScript({ cwd, args }, data, source) {

    return new Promise((resolve, reject) => {
        const child = spawn(
            process.execPath,
            [...args, '-e', source, '--', JSON.stringify(data)],
            { cwd, stdio: 'inherit' }
        )

        child.on('close', code => {
            if (code !== 0) {
                return reject(
                    {
                        command: `node ${args.join(' ')}`,
                    }
                );
            }
            return resolve();
        })
    })
}