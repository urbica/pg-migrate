/* eslint-disable no-template-curly-in-string */

const fs = require('fs');
const path = require('path');
const pgPromise = require('pg-promise');
const monitor = require('pg-monitor');
const { promisify } = require('util');

const pgPromiseOptions = { capSQL: true, pgNative: true };
const pgp = pgPromise(pgPromiseOptions);
monitor.attach(pgPromiseOptions);

const readDirAsync = promisify(fs.readdir);

function checkMigrationsTable(t, { schemaName, tableName }) {
  return t.oneOrNone(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = ${schemaName} AND table_name = ${tableName}',
    { schemaName, tableName }
  );
}

function createMigrationsTable(t, { schemaName, tableName }) {
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

function checkMigration(t, migrationId, { schemaName, tableName }) {
  return t.oneOrNone(
    'SELECT id FROM ${schemaName~}.${tableName~} WHERE id = ${migrationId}',
    { migrationId, schemaName, tableName }
  );
}

async function migrate(options, index) {
  const { schemaName, tableName, migrations } = options;

  if (index >= migrations.length) return undefined;
  const migration = migrations[index];

  const migrationId = path.parse(migration).name;
  const exists = await checkMigration(this, migrationId, options);
  if (!exists) {
    const contents = new pgp.QueryFile(migration);
    return this.batch([
      this.query(contents),
      this.query(
        'INSERT INTO ${schemaName~}.${tableName~} (id, datetime) VALUES (${migrationId}, NOW())',
        { migrationId, schemaName, tableName }
      )
    ]);
  }

  return this;
}

function runMigrations(t, options) {
  return t.tx('migrate', t2 => t2.sequence(migrate.bind(t2, options)));
}

/**
 * pgMigrate
 * prepares database and applies migrations
 *
 * @param {Object} options object
 * @param {string} options.database - database to apply migrations
 * @param {string} [options.host='localhost'] - database host
 * @param {int} [options.port=5432] - database port
 * @param {string} options.user - database user
 * @param {string} options.password - database password
 * @param {string} [options.schemaName='public'] - database migrations table schema
 * @param {string} [options.tableName='migrations'] - database migrations table name
 * @param {string} [options.migrationsDir='./migrations'] - path to migrations dir
 * @returns {Promise}
 *
 * @example
 * const pgMigrate = require('@urbica/pg-migrate');
 * pgMigrate({ database: 'test', migrationsDir: './migrations' });
 */
async function pgMigrate(options) {
  const { host, port, database, user, password } = options;
  const db = pgp({ host, port, database, user, password });

  const schemaName = options.schemaName || 'public';
  const tableName = options.tableName || 'migrations';
  const migrationsDir = options.migrationsDir || './migrations';

  const migrations = await readDirAsync(migrationsDir).then(paths =>
    paths.map(migrationPath => path.join(migrationsDir, migrationPath))
  );

  return db.tx(async (t) => {
    const tableExists = await checkMigrationsTable(t, {
      schemaName,
      tableName
    });
    if (!tableExists) {
      await createMigrationsTable(t, { schemaName, tableName });
    }
    await runMigrations(t, { schemaName, tableName, migrations });

    pgp.end();
  });
}

module.exports = pgMigrate;
