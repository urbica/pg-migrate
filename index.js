#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { docopt } = require('docopt');
const { promisify } = require('util');
const PgMigrate = require('./pg-migrate');
const packagejson = require('./package.json');

const doc = `
Urbica PostgreSQL Migrate.

Usage:
  pg-migrate [options] new <name>
  pg-migrate [options] migrate
  pg-migrate [options] rollback <N>
  pg-migrate [options] reset
  pg-migrate --help
  pg-migrate --version

Examples:
  pg-migrate new create-users
  pg-migrate migrate
  pg-migrate rollback 1
  pg-migrate reset

Options:
  --help                        Show this screen
  --version                     Show version
  --verbose                     Show verbose output
  -m --migrations-dir=DIR       The directory containing your migration files [default: ./migrations]
  -t --migrations-table=TABLE   Set the name of the migrations table          [default: migrations]
  -s --migrations-schema=SCHEMA Set the name of the migrations table scheme   [default: public]

Connection options:
  -d --db=PGDATABASE            database name to connect to
  -h --host=PGHOST              database server host or socket directory      [default: localhost]
  -p --port=PGPORT              database server port                          [default: 5432]
  -U --user=PGUSER              database user name
  -W --password=PGPASSWORD      database user name password
`;

const opt = docopt(doc, { version: packagejson.version });

const options = {
  database: opt['--db'] || process.env.PGDATABASE || process.env.POSTGRES_DB,
  host: opt['--host'] || process.env.PGHOST || process.env.POSTGRES_HOST || 'localhost',
  port: opt['--port'] || process.env.PGPORT || process.env.POSTGRES_PORT || 5432,
  user: opt['--user'] || process.env.PGUSER || process.env.POSTGRES_USER,
  password: opt['--password'] || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
  migrationsSchema: opt['--migrations-schema'],
  migrationsTable: opt['--migrations-table'],
  migrationsDir: opt['--migrations-dir'],
  verbose: opt['--verbose'] || true
};

const { root } = path.parse(options.migrationsDir);
if (root !== '/') {
  options.migrationsDir = path.join(process.cwd(), options.migrationsDir);
}

async function main() {
  /* eslint-disable no-console */

  if (opt.new) {
    const writeFileAsync = promisify(fs.writeFile);
    const content = '-- replace with your sql';
    const ts = Math.floor(new Date() / 1000);
    const baseName = `${ts}-${opt['<name>']}`;
    const up = path.format({ dir: options.migrationsDir, name: baseName, ext: '.up.sql' });
    const down = path.format({ dir: options.migrationsDir, name: baseName, ext: '.down.sql' });
    await Promise.all([writeFileAsync(up, content), writeFileAsync(down, content)]);

    console.log(up);
    console.log(down);
    return;
  }

  try {
    const pgMigrate = new PgMigrate(options);
    await pgMigrate.connect();

    if (opt.migrate) {
      await pgMigrate.migrate();
    }

    if (opt.rollback) {
      await pgMigrate.rollback(opt['<N>']);
    }

    if (opt.reset) {
      await pgMigrate.reset();
    }

    await pgMigrate.end();
  } catch (error) {
    console.error(error.message);
    process.exit(-1);
  }
}

main();
