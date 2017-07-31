# Urbica pg-migrate

## Installation

pg-migrate requires node v7.6.0 or higher for ES2015 and async function support.

    npm install -g @urbica/pg-migrate

...or build from source

    git clone https://github.com/urbica/pg-migrate.git
    cd pg-migrate
    npm install

## Create migration

    touch migrations/$(date +%s)-migration.sql

## Migrate

    pg-migrate