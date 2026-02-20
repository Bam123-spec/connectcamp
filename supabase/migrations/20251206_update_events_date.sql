-- Migrate data from 'day' to 'date' where 'date' is NULL and 'day' is not NULL
-- We attempt to cast 'day' to date. If it fails, those rows might be skipped or cause an error.
-- Assuming 'day' contains valid date strings or is convertible.
UPDATE events 
SET date = day::date 
WHERE date IS NULL AND day IS NOT NULL;

-- Ensure 'date' column is of type DATE (it likely already is, but good to be safe)
ALTER TABLE events
ALTER COLUMN date TYPE date
USING date::date;
