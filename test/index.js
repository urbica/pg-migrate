/* eslint-disable no-template-curly-in-string */

const path = require('path');
const test = require('tape');
const pgPromise = require('pg-promise');
const pgMigrate = require('../pg-migrate');

const pgPromiseOptions = { capSQL: true, pgNative: true, noWarnings: true };
const pgp = pgPromise(pgPromiseOptions);

const database = 'test';
const user = 'postgres';
const schemaName = 'public';
const tableName = 'migrations';
const migrationsDir = path.join(__dirname, './migrations');

const tableExistsQuery =
  'SELECT table_name FROM information_schema.tables WHERE table_schema = ${schemaName} AND table_name = ${tableName}';

test('pg-migration', async (t) => {
  t.plan(3);

  await pgMigrate({ database, user, migrationsDir });
  const db = pgp({ database, user });

  db
    .oneOrNone(tableExistsQuery, { schemaName, tableName })
    .then(tableExists => t.ok(tableExists, 'migrations table created'));

  db
    .oneOrNone(tableExistsQuery, { schemaName: 'public', tableName: 'users' })
    .then(tableExists => t.ok(tableExists, 'first migration applied'));

  db
    .oneOrNone(tableExistsQuery, { schemaName: 'public', tableName: 'posts' })
    .then(tableExists => t.ok(tableExists, 'second migration applied'));
});

test.onFinish(() => pgp.end());
