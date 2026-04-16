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
const CONFIG_DIR = path.join(os.homedir(), '.youtube-publish');
const PYTHON_SCRIPT = path.join(SCRIPTS_DIR, 'upload_to_youtube.py');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function checkPython() {
  try {
    execSync('python3 --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function checkPythonDeps() {
  try {
    execSync('python3 -c "import google.oauth2; import googleapiclient"', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function installPythonDeps() {
  console.log(chalk.yellow('Installing Python dependencies...'));
  try {
    execSync('pip3 install google-auth google-auth-oauthlib google-api-python-client', {
      stdio: 'inherit',
    });
    console.log(chalk.green('Python dependencies installed!'));
    return true;
  } catch {
    console.error(chalk.red('Failed to install Python dependencies.'));
    console.error('   Try manually: pip3 install google-auth google-auth-oauthlib google-api-python-client');
    return false;
  }
}

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

function requireSetup() {
  ensureConfigDir();
  const clientSecret = path.join(CONFIG_DIR, 'client_secret.json');
  if (!fs.existsSync(clientSecret)) {
    console.error(chalk.red('\n  Not set up yet. You need a client_secret.json from Google.\n'));
    console.error(`  Run ${chalk.cyan('youtube-publish guide')} for step-by-step instructions.`);
    console.error(`  Then ${chalk.cyan('youtube-publish setup --client ./client_secret.json')}\n`);
    process.exit(1);
  }
}

// ============ PROGRAM ============

program
  .name('youtube-publish')
  .version(pkg.version)
  .description(
    'Bulk upload and schedule YouTube videos from the command line.\n\n' +
    'Quick start:\n' +
    '  1. youtube-publish guide                          Get Google API credentials\n' +
    '  2. youtube-publish setup --client ./creds.json    Save credentials\n' +
    '  3. youtube-publish auth                           Login with Google\n' +
    '  4. youtube-publish upload --path ./videos/        Upload videos'
  )
  .addHelpText('after', `
${chalk.bold('Examples:')}

  ${chalk.dim('# First time setup')}
  youtube-publish guide
  youtube-publish setup --client ~/Downloads/client_secret.json
  youtube-publish auth

  ${chalk.dim('# Upload all videos from a folder')}
  youtube-publish upload --path ./videos/

  ${chalk.dim('# Preview what would be uploaded')}
  youtube-publish upload --path ./videos/ --dry-run

  ${chalk.dim('# Upload only files matching a pattern')}
  youtube-publish upload --path ./videos/ --filter react

  ${chalk.dim('# Schedule 1 video/day starting May 1st')}
  youtube-publish upload --path ./videos/ --schedule 2026-05-01

  ${chalk.dim('# Schedule every 3 days at a specific time')}
  youtube-publish upload --path ./videos/ --schedule 2026-05-01 --interval 3 --time 14:00

  ${chalk.dim('# Auto-schedule 3/day at peak times (8AM, 2PM, 6PM UTC)')}
  youtube-publish upload --path ./videos/ --auto --auto-from 2026-05-01

  ${chalk.dim('# Upload and add to a playlist')}
  youtube-publish upload --path ./videos/ --playlist "JS Tips"

  ${chalk.dim('# Check upload status')}
  youtube-publish list --path ./videos/
`);

// ---- GUIDE ----
program
  .command('guide')
  .description('Step-by-step instructions to get client_secret.json from Google')
  .action(() => {
    console.log(`
${chalk.bold('How to get your Google API credentials (client_secret.json)')}
${chalk.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}

${chalk.yellow('Step 1:')} Go to Google Cloud Console
   https://console.cloud.google.com/

${chalk.yellow('Step 2:')} Create a new project (or select an existing one)
   Click the project dropdown at the top → "New Project"
   Name it anything (e.g. "YouTube Uploader")

${chalk.yellow('Step 3:')} Enable the YouTube Data API v3
   Go to: APIs & Services → Library
   Search "YouTube Data API v3" → Click → Enable

${chalk.yellow('Step 4:')} Configure the OAuth consent screen
   Go to: APIs & Services → OAuth consent screen
   Choose "External" → Create
   Fill in app name (e.g. "YouTube Uploader") and your email
   Add scope: ../auth/youtube.upload
   Add yourself as a test user
   Save

${chalk.yellow('Step 5:')} Create OAuth 2.0 credentials
   Go to: APIs & Services → Credentials
   Click "Create Credentials" → "OAuth 2.0 Client ID"
   Application type: ${chalk.bold('Desktop app')}
   Name it anything → Create

${chalk.yellow('Step 6:')} Download the JSON file
   Click the download icon (⬇) next to your new credential
   Save it as ${chalk.cyan('client_secret.json')}

${chalk.yellow('Step 7:')} Run setup
   ${chalk.cyan('youtube-publish setup --client ./client_secret.json')}
   ${chalk.cyan('youtube-publish auth')}

${chalk.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
${chalk.dim('Note: The OAuth consent screen will show "unverified app" warning.')}
${chalk.dim('This is normal for personal use. Click "Advanced" → "Go to app".')}
${chalk.dim('Google may take a few minutes to propagate the API enablement.')}
`);
  });

// ---- SETUP ----
program
  .command('setup')
  .description('Install Python dependencies and save Google credentials')
  .option('-c, --client <path>', 'Path to client_secret.json downloaded from Google Cloud Console')
  .addHelpText('after', `
${chalk.bold('Examples:')}
  youtube-publish setup --client ./client_secret.json
  youtube-publish setup --client ~/Downloads/client_secret_12345.json
  youtube-publish setup                                  ${chalk.dim('# Check status only')}

${chalk.dim('Don\'t have client_secret.json yet? Run: youtube-publish guide')}
`)
  .action((opts) => {
    console.log(chalk.bold('\nYouTube Publish Setup\n'));

    ensureConfigDir();

    if (!checkPython()) {
      console.error(chalk.red('Python 3 is required but not found.'));
      console.error('   Install from https://www.python.org/downloads/');
      process.exit(1);
    }
    console.log(chalk.green('  Python 3 found'));

    if (!checkPythonDeps()) {
      if (!installPythonDeps()) process.exit(1);
    } else {
      console.log(chalk.green('  Python dependencies installed'));
    }

    if (opts.client) {
      const src = path.resolve(opts.client);
      if (!fs.existsSync(src)) {
        console.error(chalk.red(`  File not found: ${src}`));
        process.exit(1);
      }
      const dest = path.join(CONFIG_DIR, 'client_secret.json');
      fs.copyFileSync(src, dest);
      console.log(chalk.green(`  Saved credentials → ${dest}`));
    } else {
      const existing = path.join(CONFIG_DIR, 'client_secret.json');
      if (fs.existsSync(existing)) {
        console.log(chalk.green(`  Credentials found at ${existing}`));
      } else {
        console.log(chalk.yellow('\n  No credentials found.'));
        console.log(`  Run ${chalk.cyan('youtube-publish guide')} to learn how to get them.`);
        console.log(`  Then ${chalk.cyan('youtube-publish setup --client ./client_secret.json')}`);
      }
    }

    console.log(chalk.bold('\n  Setup complete!'));
    console.log(`  Config: ${CONFIG_DIR}`);
    console.log(`  Next:   ${chalk.cyan('youtube-publish auth')}\n`);
  });

// ---- AUTH ----
program
  .command('auth')
  .description('Authenticate with Google (opens browser for one-time OAuth login)')
  .addHelpText('after', `
${chalk.dim('Opens your browser for Google login. Token is saved at ~/.youtube-publish/')}
${chalk.dim('You only need to do this once. Token auto-refreshes after that.')}
`)
  .action(() => {
    requireSetup();
    runPython(['--auth']);
  });

// ---- UPLOAD ----
program
  .command('upload')
  .description('Upload videos to YouTube with optional scheduling')
  .option('-p, --path <dir>', 'Path to directory containing .mp4 files', './videos')
  .option('-f, --file <file>', 'Upload a single video file instead of a directory')
  .option('--filter <keyword>', 'Only upload videos whose filename contains this keyword')
  .option('-s, --schedule <date>', 'Schedule uploads starting from this date (YYYY-MM-DD)')
  .option('-i, --interval <days>', 'Days between each scheduled upload (default: 1)', '1')
  .option('-t, --time <HH:MM>', 'Publish time in UTC for --schedule (default: 18:00)', '18:00')
  .option('--auto', 'Auto-schedule 3 videos/day at peak engagement times (8AM, 2PM, 6PM UTC)')
  .option('--auto-from <date>', 'Start date for --auto scheduling (YYYY-MM-DD, default: tomorrow)')
  .option('--privacy <status>', 'Video privacy: public, private, unlisted (default: public)', 'public')
  .option('--playlist <name>', 'Add videos to a playlist (by name or ID, creates if not found)')
  .option('--category <id>', 'YouTube category ID (default: 28 = Science & Tech)', '28')
  .option('--dry-run', 'Preview what would be uploaded without actually uploading')
  .addHelpText('after', `
${chalk.bold('Schedule options:')}

  ${chalk.dim('# Basic: 1 video/day at 6PM UTC starting May 1st')}
  youtube-publish upload -p ./videos/ --schedule 2026-05-01

  ${chalk.dim('# Every 2 days at 2PM UTC')}
  youtube-publish upload -p ./videos/ --schedule 2026-05-01 --interval 2 --time 14:00

  ${chalk.dim('# Auto: 3 videos/day at peak times (8AM, 2PM, 6PM UTC)')}
  youtube-publish upload -p ./videos/ --auto

  ${chalk.dim('# Auto starting from a specific date')}
  youtube-publish upload -p ./videos/ --auto --auto-from 2026-05-01

${chalk.bold('Filter:')}

  ${chalk.dim('# Only upload videos with "react" in the filename')}
  youtube-publish upload -p ./videos/ --filter react

  ${chalk.dim('# Combine filter with schedule')}
  youtube-publish upload -p ./videos/ --filter closure --schedule 2026-05-01

${chalk.bold('Privacy:')}
  --privacy public      ${chalk.dim('Visible to everyone (default)')}
  --privacy unlisted    ${chalk.dim('Only accessible via direct link')}
  --privacy private     ${chalk.dim('Only visible to you')}

${chalk.bold('Category IDs:')} 22=People & Blogs, 24=Entertainment, 27=Education, 28=Science & Tech
`)
  .action((opts) => {
    requireSetup();

    const args = [];
    if (opts.file) args.push('--file', path.resolve(opts.file));
    if (opts.filter) args.push('--filter', opts.filter);
    if (opts.schedule) args.push('--schedule', opts.schedule);
    if (opts.interval && opts.interval !== '1') args.push('--interval', opts.interval);
    if (opts.time && opts.time !== '18:00') args.push('--time', opts.time);
    if (opts.auto) args.push('--auto');
    if (opts.autoFrom) args.push('--auto-from', opts.autoFrom);
    if (opts.privacy && opts.privacy !== 'public') args.push('--privacy', opts.privacy);
    if (opts.playlist) args.push('--playlist', opts.playlist);
    if (opts.category && opts.category !== '28') args.push('--category', opts.category);
    if (opts.dryRun) args.push('--dry-run');

    runPython(args, opts.path);
  });

// ---- LIST ----
program
  .command('list')
  .description('Show upload status of all videos in a directory')
  .option('-p, --path <dir>', 'Path to videos directory', './videos')
  .option('--filter <keyword>', 'Only show videos whose filename contains this keyword')
  .addHelpText('after', `
${chalk.bold('Examples:')}
  youtube-publish list --path ./videos/
  youtube-publish list --path ./videos/ --filter react
`)
  .action((opts) => {
    ensureConfigDir();
    const args = ['--list'];
    if (opts.filter) args.push('--filter', opts.filter);
    runPython(args, opts.path);
  });

// ---- RESET ----
program
  .command('reset')
  .description('Clear upload history so videos can be re-uploaded')
  .option('-p, --path <dir>', 'Path to videos directory', './videos')
  .action((opts) => {
    const historyFile = path.join(path.resolve(opts.path), '.yt-upload-history.json');
    if (fs.existsSync(historyFile)) {
      fs.unlinkSync(historyFile);
      console.log(chalk.green(`  Cleared upload history: ${historyFile}`));
    } else {
      console.log('  No upload history found.');
    }
  });

// Default: show help
program.action(() => {
  program.help();
});

program.parse(process.argv);
