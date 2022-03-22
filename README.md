# Urbica PG Migrate

[![npm version](https://img.shields.io/npm/v/@urbica/pg-migrate.svg)](https://www.npmjs.com/package/@urbica/pg-migrate)
[![npm downloads](https://img.shields.io/npm/dt/@urbica/pg-migrate.svg)](https://www.npmjs.com/package/@urbica/pg-migrate)
[![CI](https://github.com/urbica/pg-migrate/workflows/CI/badge.svg)](https://github.com/urbica/pg-migrate/actions)

PostgreSQL migration tool.

[Documentation](https://urbica.github.io/pg-migrate/).

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
  -c --connection=DATABASE_URL        database connection string in libpq format
  -d --db=PGDATABASE                  database name to connect to
  -h --host=PGHOST                    database server host or socket directory      [default: localhost]
  -p --port=PGPORT                    database server port                          [default: 5432]
  -U --user=PGUSER                    database user name
  -W --password=PGPASSWORD            database user name password
```

## Node.js API

Using Promises

```js
const PgMigrate = require('@urbica/pg-migrate');
const pgMigrate = new PgMigrate({
  database: 'test',
  migrationsDir: './migrations'
});

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

See [API](https://urbica.github.io/pg-migrate/) for more info.
