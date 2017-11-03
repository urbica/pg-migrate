# Urbica PG Migrate

[![npm version](https://img.shields.io/npm/v/@urbica/pg-migrate.svg)](https://www.npmjs.com/package/@urbica/pg-migrate)
[![npm downloads](https://img.shields.io/npm/dt/@urbica/pg-migrate.svg)](https://www.npmjs.com/package/@urbica/pg-migrate)
[![Build Status](https://travis-ci.org/urbica/pg-migrate.svg?branch=master)](https://travis-ci.org/urbica/pg-migrate)

PostgreSQL migration tool.

![Screenshot](https://raw.githubusercontent.com/urbica/pg-migrate/master/screenshot.png)

## Installation

`pg-migrate` requires node v7.6.0 or higher for ES2015 and async function support.

```shell
npm install -g @urbica/pg-migrate
```

...or build from source

```shell
git clone https://github.com/urbica/pg-migrate.git
cd pg-migrate
npm install
```

## Usage

```shell
Usage: pg-migrate [options]

where [options] is any of:
  --database (PGDATABASE) - database to apply migrations (required)
  --host (PGHOST) - database host (default: localhost)
  --port (PGPORT) - database port (default: 5432)
  --user (PGUSER) - database user
  --password (PGPASSWORD) - database password
  --schemaName - database migrations table schema (default: public)
  --tableName - database migrations table name (default: migrations)
  --migrationsDir - path to migrations (default: ./migrations)
  --attachMonitor - attach pg-monitor (default: true)
  --version - returns running version then exits
```

## Example

Create and write migrations and then run them

```shell
touch migrations/$(date +%s)-migration_name.{up,down}.sql
pg-migrate --database=test --migrationsDir=./migrations
```

## Node.js API

Using Promises

```js
const PgMigrate = require('@urbica/pg-migrate');
const pgMigrate = new PgMigrate({ database: 'test', migrationsDir: './migrations' });

pgMigrate
 .connect()
 .then(() => pgMigrate.migrate())
 .then(() => pgMigrate.end());
```

...or using async/await

```js
const pgMigrate = new PgMigrate({ database, user, migrationsDir });

async function migrate() {
  await pgMigrate.connect();
  await pgMigrate.migrate();
  await pgMigrate.end();
}

migrate();
```

See [API](https://github.com/urbica/pg-migrate/blob/master/API.md) for more info.
