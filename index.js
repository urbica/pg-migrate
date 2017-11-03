#!/usr/bin/env node

const path = require('path');
const minimist = require('minimist');
const PgMigrate = require('./pg-migrate');
const packagejson = require('./package.json');

const config = minimist(process.argv.slice(2), {
  string: [
    'database',
    'host',
    'port',
    'user',
    'password',
    'schemaName',
    'tableName',
    'migrationsDir',
    'attachMonitor'
  ],
  alias: {
    h: 'help',
    v: 'version'
  },
  default: {
    database: process.env.PGDATABASE,
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    schemaName: 'public',
    tableName: 'migrations',
    migrationsDir: './migrations',
    attachMonitor: true
  }
});

if (config.version) {
  process.stdout.write(`${packagejson.version}\n`);
  process.exit(0);
}

function printHelp() {
  const help = `
  Usage: pg-migrate [options]

  where [options] is any of:
    --database (PGDATABASE) - database to apply migrations (required)
    --host (PGHOST) - database host (default: ${config.host})
    --port (PGPORT) - database port (default: ${config.port})
    --user (PGUSER) - database user
    --password (PGPASSWORD) - database password
    --schemaName - database migrations table schema (default: ${config.schemaName})
    --tableName - database migrations table name (default: ${config.tableName})
    --migrationsDir - path to migrations (default: ${config.migrationsDir})
    --attachMonitor - attach pg-monitor (default: ${config.attachMonitor})
    --version - returns running version then exits

  pg-migrate@${packagejson.version}
  node@${process.versions.node}
  `;
  process.stdout.write(`${help}\n`);
}

if (config.help) {
  printHelp();
  process.exit(0);
}

if (!config.database) {
  process.stderr.write('ERROR: database not specified\n');
  printHelp();
  process.exit(-1);
}

let migrationsDir;
const { root } = path.parse(config.migrationsDir);
if (root === '/') {
  // eslint-disable-next-line
  migrationsDir = config.migrationsDir;
} else {
  migrationsDir = path.join(__dirname, config.migrationsDir);
}

const options = {
  host: config.host,
  port: config.port,
  database: config.database,
  user: config.user,
  password: config.password,
  schemaName: config.schemaName,
  tableName: config.tableName,
  attachMonitor: config.attachMonitor,
  migrationsDir
};

async function main() {
  try {
    const pgMigrate = new PgMigrate(options);
    await pgMigrate.connect();
    await pgMigrate.migrate();
    await pgMigrate.end();
  } catch (error) {
    /* eslint-disable no-console */
    console.error(error);
    /* eslint-enable no-console */
    process.exit(-1);
  }
}

main();
