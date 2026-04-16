#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const chalk = require('chalk');

const pkg = require('../package.json');
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');
const CONFIG_DIR = path.join(os.homedir(), '.yt-upload');
const PYTHON_SCRIPT = path.join(SCRIPTS_DIR, 'upload_to_youtube.py');

// Ensure config dir exists
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// Check Python3 is available
function checkPython() {
  try {
    execSync('python3 --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Check Python dependencies
function checkPythonDeps() {
  try {
    execSync('python3 -c "import google.oauth2; import googleapiclient"', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Install Python dependencies
function installPythonDeps() {
  console.log(chalk.yellow('📦 Installing Python dependencies...'));
  try {
    execSync('pip3 install google-auth google-auth-oauthlib google-api-python-client', {
      stdio: 'inherit',
    });
    console.log(chalk.green('✅ Python dependencies installed!'));
    return true;
  } catch {
    console.error(chalk.red('❌ Failed to install Python dependencies.'));
    console.error('   Try manually: pip3 install google-auth google-auth-oauthlib google-api-python-client');
    return false;
  }
}

// Run the Python upload script with arguments
function runPython(args, videosPath) {
  const env = {
    ...process.env,
    YT_UPLOAD_CONFIG_DIR: CONFIG_DIR,
  };
  if (videosPath) {
    env.YT_UPLOAD_VIDEOS_DIR = path.resolve(videosPath);
  }

  const child = spawn('python3', [PYTHON_SCRIPT, ...args], {
    stdio: 'inherit',
    env,
  });

  child.on('close', (code) => {
    process.exit(code || 0);
  });
}

program
  .name('yt-upload')
  .version(pkg.version)
  .description('Bulk upload and schedule YouTube videos from the command line');

// ---- SETUP ----
program
  .command('setup')
  .description('Set up credentials and install Python dependencies')
  .option('-c, --client <path>', 'Path to client_secret.json from Google Cloud Console')
  .action((opts) => {
    console.log(chalk.bold('\n🎬 yt-upload Setup\n'));

    ensureConfigDir();

    // Check Python
    if (!checkPython()) {
      console.error(chalk.red('❌ Python 3 is required but not found.'));
      console.error('   Install from https://www.python.org/downloads/');
      process.exit(1);
    }
    console.log(chalk.green('✅ Python 3 found'));

    // Install deps
    if (!checkPythonDeps()) {
      if (!installPythonDeps()) process.exit(1);
    } else {
      console.log(chalk.green('✅ Python dependencies already installed'));
    }

    // Copy client_secret.json
    if (opts.client) {
      const src = path.resolve(opts.client);
      if (!fs.existsSync(src)) {
        console.error(chalk.red(`❌ File not found: ${src}`));
        process.exit(1);
      }
      const dest = path.join(CONFIG_DIR, 'client_secret.json');
      fs.copyFileSync(src, dest);
      console.log(chalk.green(`✅ Copied client_secret.json → ${dest}`));
    } else {
      const existing = path.join(CONFIG_DIR, 'client_secret.json');
      if (fs.existsSync(existing)) {
        console.log(chalk.green(`✅ client_secret.json already at ${existing}`));
      } else {
        console.log(chalk.yellow('\n📋 Next steps:'));
        console.log('  1. Go to https://console.cloud.google.com');
        console.log('  2. Create a project → Enable YouTube Data API v3');
        console.log('  3. Create OAuth 2.0 credentials (Desktop app)');
        console.log('  4. Download the JSON file');
        console.log(`  5. Run: ${chalk.cyan('yt-upload setup --client ./client_secret.json')}`);
      }
    }

    console.log(chalk.bold('\n✅ Setup complete!\n'));
    console.log(`  Config directory: ${CONFIG_DIR}`);
    console.log(`  Next: ${chalk.cyan('yt-upload auth')}`);
    console.log('');
  });

// ---- AUTH ----
program
  .command('auth')
  .description('Authenticate with Google (opens browser for one-time login)')
  .action(() => {
    ensureConfigDir();
    const clientSecret = path.join(CONFIG_DIR, 'client_secret.json');
    if (!fs.existsSync(clientSecret)) {
      console.error(chalk.red('❌ client_secret.json not found.'));
      console.error(`   Run: ${chalk.cyan('yt-upload setup --client ./client_secret.json')}`);
      process.exit(1);
    }
    runPython(['--auth']);
  });

// ---- UPLOAD ----
program
  .command('upload')
  .description('Upload videos to YouTube')
  .option('-p, --path <dir>', 'Path to videos directory', './videos')
  .option('-f, --file <file>', 'Upload a single video file')
  .option('-s, --schedule <date>', 'Schedule start date (YYYY-MM-DD), 1/day at 6PM UTC')
  .option('-i, --interval <days>', 'Days between uploads for --schedule', '1')
  .option('--auto', 'Auto-schedule 3 videos/day at peak times')
  .option('--auto-from <date>', 'Start date for --auto (YYYY-MM-DD, default: tomorrow)')
  .option('--playlist <name>', 'Add to playlist (name or ID, creates if not found)')
  .option('--dry-run', 'Preview without uploading')
  .action((opts) => {
    ensureConfigDir();
    const clientSecret = path.join(CONFIG_DIR, 'client_secret.json');
    if (!fs.existsSync(clientSecret)) {
      console.error(chalk.red('❌ Not set up yet.'));
      console.error(`   Run: ${chalk.cyan('yt-upload setup --client ./client_secret.json')}`);
      process.exit(1);
    }

    const args = [];
    if (opts.file) args.push('--file', path.resolve(opts.file));
    if (opts.schedule) args.push('--schedule', opts.schedule);
    if (opts.interval && opts.interval !== '1') args.push('--interval', opts.interval);
    if (opts.auto) args.push('--auto');
    if (opts.autoFrom) args.push('--auto-from', opts.autoFrom);
    if (opts.playlist) args.push('--playlist', opts.playlist);
    if (opts.dryRun) args.push('--dry-run');

    runPython(args, opts.path);
  });

// ---- LIST ----
program
  .command('list')
  .description('Show upload status of videos')
  .option('-p, --path <dir>', 'Path to videos directory', './videos')
  .action((opts) => {
    ensureConfigDir();
    runPython(['--list'], opts.path);
  });

// Default: show help
program.action(() => {
  program.help();
});

program.parse(process.argv);
