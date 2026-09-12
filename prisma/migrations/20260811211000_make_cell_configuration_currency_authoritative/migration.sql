INSERT INTO "CellConfiguration" ("id", "defaultCurrency", "createdAt", "updatedAt")
SELECT
    'default',
    COALESCE(
        (SELECT "defaultCurrency" FROM "BusinessSettings" WHERE "id" = 'default'),
        'INR'::"CurrencyCode"
    ),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "CellConfiguration" WHERE "id" = 'default');
