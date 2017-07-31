/* eslint-disable no-template-curly-in-string */

const fs = require('fs');
const path = require('path');
const pgPromise = require('pg-promise');
const monitor = require('pg-monitor');
const { promisify } = require('util');

const options = { capSQL: true, pgNative: true };
const pgp = pgPromise(options);
monitor.attach(options);

const readDirAsync = promisify(fs.readdir);

const database = process.env.POSTGRES_DB;
const host = process.env.POSTGRES_HOST || 'localhost';
const port = process.env.POSTGRES_PORT || 5432;
const user = process.env.POSTGRES_USER;
const password = process.env.POSTGRES_PASSWORD;

const connection = { host, port, database, user, password };
const db = pgp(connection);

const schemaName = 'public';
const tableName = 'migrations';
const migrationsDir = './migrations';

/**
 * checkMigrationsTable
 * check if migrations table exists
 */
function checkMigrationsTable(t) {
  return t.oneOrNone(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = ${schemaName} AND table_name = ${tableName}',
    { schemaName, tableName }
  );
}

/**
 * createMigrationsTable
 * create migrations table
 */
function createMigrationsTable(t) {
  return t.tx('create-table', (t2) => {
    const q1 = t2.none(
      'CREATE TABLE ${schemaName~}.${tableName~} (id varchar, datetime timestamp with time zone)',
      { schemaName, tableName }
    );
    const q2 = t2.none(
      'CREATE UNIQUE INDEX ON ${schemaName~}.${tableName~} (id)',
      { schemaName, tableName }
    );

    return t.batch([q1, q2]);
  });
}

/**
 * checkMigration
 * check if migration exists
 */
function checkMigration(t, id) {
  return t.oneOrNone(
    'SELECT id FROM ${schemaName~}.${tableName~} WHERE id = ${id}',
    { id, schemaName, tableName }
  );
}

/**
 * migrate
 * evaluate migration
 */
async function migrate(migrations, index) {
  if (index >= migrations.length) return undefined;
  const migration = migrations[index];

  const exists = await checkMigration(this, migration);
  if (!exists) {
    const contents = new pgp.QueryFile(path.join(migrationsDir, migration));
    return this.batch([
      this.query(contents),
      this.query(
        'INSERT INTO ${schemaName~}.${tableName~} (id, datetime) VALUES (${migration}, NOW())',
        { migration, schemaName, tableName }
      )
    ]);
  }

  return this;
}

/**
 * runMigrations
 * evaluate migrations
 */
function runMigrations(t, migrations) {
  return t.tx('migrate', t2 => t2.sequence(migrate.bind(t2, migrations)));
}

async function main() {
  try {
    const migrations = await readDirAsync(migrationsDir);
    await db.tx(async (t) => {
      const tableExists = await checkMigrationsTable(t);
      if (!tableExists) await createMigrationsTable(t);
      await runMigrations(t, migrations);
    });
  } catch (error) {
    /* eslint-disable no-console */
    console.error(error);
    /* eslint-enable no-console */
    process.exit(-1);
  }

  pgp.end();
}

main();
