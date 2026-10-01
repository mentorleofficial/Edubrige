-- New enum value must be added in its own migration: Postgres cannot use a value
-- added by ALTER TYPE ... ADD VALUE inside the same transaction that adds it.
-- 'invited' marks a mentor who was created by an admin invite and has not yet
-- submitted an application, so their dashboard shows onboarding wording instead
-- of the misleading "changes requested / rejected" copy.
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'invited';
