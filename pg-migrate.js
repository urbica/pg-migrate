/* eslint-disable no-template-curly-in-string */

const fs = require('fs');
const path = require('path');
const pgPromise = require('pg-promise');
const monitor = require('pg-monitor');
const { promisify } = require('util');

const pgPromiseOptions = { capSQL: true };
const pgp = pgPromise(pgPromiseOptions);

const readDirAsync = promisify(fs.readdir);
const readMigrations = migrationsDir =>
  readDirAsync(migrationsDir).then(migrationPaths =>
    migrationPaths.reduce((acc, migrationPath) => {
      const matches = migrationPath.match(/^(\w*-[\w-]*)\.(up|down)\.sql$/i);
      if (matches) {
        const [, name, action] = matches;
        const migration = path.join(migrationsDir, migrationPath);
        if (acc[name]) {
          acc[name][action] = migration;
        } else {
          acc[name] = { [action]: migration };
        }
      }
      return acc;
    }, {}));

/**
 * PgMigrate
 *
 * @param {Object} options object
 * @param {string} options.database - database to apply migrations
 * @param {string} [options.host='localhost'] - database host
 * @param {int} [options.port=5432] - database port
 * @param {string} options.user - database user
 * @param {string} options.password - database password
 * @param {boolean} options.ssl - can also be ISSLConfig-like option https://github.com/vitaly-t/pg-promise/wiki/Connection-Syntax#configuration-object 
 * @param {string} [options.migrationsSchema='public'] - database migrations table schema
 * @param {string} [options.migrationsTable='migrations'] - database migrations table name
 * @param {string} [options.migrationsDir='./migrations'] - path to migrations dir
 * @param {boolean} [options.verbose=false] - attach [pg-monitor](https://github.com/vitaly-t/pg-monitor)
 * @returns {Promise}
 *
 * @example
 * const PgMigrate = require('@urbica/pg-migrate');
 * const pgMigrate = new PgMigrate({ database: 'test', migrationsDir: './migrations' });
 *
 * pgMigrate
 *  .connect()
 *  .then(() => pgMigrate.migrate())
 *  .then(() => pgMigrate.end());
 */
function PgMigrate(options) {
  const { host, port, database, user, password, ssl } = options;

  if (options.verbose) {
    monitor.attach(pgPromiseOptions);
  }

  this._db = pgp({ host, port, database, user, password, ssl });
  this._migrationsDir = options.migrationsDir || './migrations';
  this._migrationsTable = {
    schemaName: options.migrationsSchema || 'public',
    tableName: options.migrationsTable || 'migrations'
  };
}

/**
 * prepares database and reads migrations
 *
 * @returns {Promise}
 *
 * @example
 * const PgMigrate = require('@urbica/pg-migrate');
 * const pgMigrate = new PgMigrate();
 * pgMigrate.connect();
 */
PgMigrate.prototype.connect = async function connect() {
  const migrations = await readMigrations(this._migrationsDir);
  this._migrations = migrations;
  await this.checkMigrationsTable();
  this._connected = true;
  return this;
};

PgMigrate.prototype.checkMigrationsTable = function checkMigrationsTable() {
  const checkTable =
    'SELECT table_name FROM information_schema.tables WHERE table_schema = ${schemaName} AND table_name = ${tableName}';

  const createTable =
    'CREATE TABLE ${schemaName~}.${tableName~} (id serial primary key, name varchar, datetime timestamp with time zone)';

  const createIndex =
    'CREATE UNIQUE INDEX ON ${schemaName~}.${tableName~} (id, name)';

  return this._db.tx('check-migrations-table', async (t) => {
    const exists = await t.oneOrNone(checkTable, this._migrationsTable);
    if (!exists) {
      await t.batch([
        t.none(createTable, this._migrationsTable),
        t.none(createIndex, this._migrationsTable)
      ]);
    }
  });
};

/**
 * runs migrations
 *
 * @returns {Promise}
 *
 * @example
 * const PgMigrate = require('@urbica/pg-migrate');
 * const pgMigrate = new PgMigrate();
 * pgMigrate
 *  .connect()
 *  .then(() => pgMigrate.migrate());
 */
PgMigrate.prototype.migrate = function migrate() {
  if (!this._connected) {
    throw new Error('You should connect to the database before migrating');
  }

  const checkMigration =
    'SELECT id FROM ${schemaName~}.${tableName~} WHERE name = ${migrationName}';

  const insertMigration =
    'INSERT INTO ${schemaName~}.${tableName~} (name, datetime) VALUES (${migrationName}, NOW())';

  const migrationNames = Object.keys(this._migrations);
  return this._db.tx('migrate', t =>
    t.sequence(async (index) => {
      if (index >= migrationNames.length) return undefined;
      const migrationName = migrationNames[index];
      const options = { ...this._migrationsTable, migrationName };
      const exists = await t.oneOrNone(checkMigration, options);
      if (exists) return t;

      const migration = this._migrations[migrationName].up;
      const contents = new pgp.QueryFile(migration);
      return t.batch([t.query(contents), t.query(insertMigration, options)]);
    }));
};

/**
 * rollbacks migrations
 *
 * @param {int} [limit=1] - number of migrations to rollback
 * @returns {Promise}
 *
 * @example
 * const PgMigrate = require('@urbica/pg-migrate');
 * const pgMigrate = new PgMigrate();
 * pgMigrate
 *  .connect()
 *  .then(() => pgMigrate.rollback(1));
 */
PgMigrate.prototype.rollback = function rollback(limit = 1) {
  if (!this._connected) {
    throw new Error('You should connect to the database before rollback');
  }

  const selectMigrations =
    'SELECT name FROM ${schemaName~}.${tableName~} ORDER BY id DESC LIMIT ${limit}';

  const deleteMigration =
    'DELETE FROM ${schemaName~}.${tableName~} WHERE name = ${migrationName}';

  return this._db.tx('rollback', async (t) => {
    const migrationNames = await t.map(
      selectMigrations,
      { ...this._migrationsTable, limit: +limit },
      migration => migration.name
    );

    return t.sequence((index) => {
      if (index >= migrationNames.length) return undefined;

      const migrationName = migrationNames[index];
      const options = { ...this._migrationsTable, migrationName };
      const migration = this._migrations[migrationName].down;
      const contents = new pgp.QueryFile(migration);
      return t.batch([t.query(contents), t.query(deleteMigration, options)]);
    });
  });
};

/**
 * rollbacks all migrations
 *
 * @returns {Promise}
 *
 * @example
 * const PgMigrate = require('@urbica/pg-migrate');
 * const pgMigrate = new PgMigrate();
 * pgMigrate
 *  .connect()
 *  .then(() => pgMigrate.reset());
 */
PgMigrate.prototype.reset = function reset() {
  if (!this._connected) {
    throw new Error('You should connect to the database before reset');
  }

  const selectMigrations =
    'SELECT name FROM ${schemaName~}.${tableName~} ORDER BY id DESC';
  const deleteMigration =
    'DELETE FROM ${schemaName~}.${tableName~} WHERE name = ${migrationName}';

  return this._db.tx('reset', async (t) => {
    const migrationNames = await t.map(
      selectMigrations,
      this._migrationsTable,
      migration => migration.name
    );

    return t.sequence((index) => {
      if (index >= migrationNames.length) return undefined;

      const migrationName = migrationNames[index];
      const options = { ...this._migrationsTable, migrationName };
      const migration = this._migrations[migrationName].down;
      const contents = new pgp.QueryFile(migration);
      return t.batch([t.query(contents), t.query(deleteMigration, options)]);
    });
  });
};

/**
 * closes database connection
 *
 * @returns {Promise}
 *
 * @example
 * const PgMigrate = require('@urbica/pg-migrate');
 * const pgMigrate = new PgMigrate();
 * pgMigrate
 *  .connect()
 *  .then(() => pgMigrate.end());
 */
PgMigrate.prototype.end = function end() {
  pgp.end();
};

module.exports = PgMigrate;
