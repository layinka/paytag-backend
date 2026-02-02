# Database Migrations

This directory will contain generated migration files.

## Generate Migrations

After defining or modifying schemas in `src/db/schemas/`, run:

```bash
npm run db:generate
```

This will create timestamped SQL migration files here.

## Run Migrations

To apply migrations to your database:

```bash
npm run db:migrate
```

## Migration Files

Files will be automatically named like:
- `0000_migration_name.sql`
- `0001_another_migration.sql`

Do not manually edit these files. Always modify the schemas and regenerate.
