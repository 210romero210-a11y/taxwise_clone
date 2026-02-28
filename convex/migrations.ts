import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

export const migrations = new Migrations<DataModel>(components.migrations, {
    internalMutation,
    migrationsLocationPrefix: "migrations:",
});

// Export the runner so we can trigger migrations from the CLI:
// npx convex run migrations:run '{"fn": "migrations:addTaxYearField"}'
export const run = migrations.runner();

/**
 * 2025 Tax Law Update Migration:
 * Adds 'taxYear' classification to existing returns that don't have it.
 */
export const addTaxYearToReturns = migrations.define({
    table: "returns",
    migrateOne: async (ctx, doc) => {
        if (doc.taxYear === undefined) {
            await ctx.db.patch(doc._id, { taxYear: 2024 });
        }
    },
});

/**
 * RBAC Migration:
 * Ensures all users have a 'role' field set to 'Preparer' as a default.
 */
export const setDefaultUserRole = migrations.define({
    table: "users",
    migrateOne: async (ctx, doc) => {
        if (!doc.role) {
            await ctx.db.patch(doc._id, { role: "Preparer" });
        }
    },
});
