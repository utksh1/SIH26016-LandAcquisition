-- Migration: 006_reenable_postgis.sql
-- Description: Re-enable PostGIS extension and convert JSONB geometry columns
-- back to native geometry types with GiST spatial indexes.
--
-- This migration is idempotent — safe to run on:
--   (a) fresh installs where 001_initial.sql already created geometry columns
--       (the ALTER TYPE blocks become no-ops when the column is already geometry)
--   (b) legacy installs where 001_initial.sql created JSONB columns
--       (the ALTER TYPE blocks convert JSONB → geometry via ST_GeomFromGeoJSON)
--
-- Background: PostGIS was disabled in commit 8aeeffa to simplify the initial
-- bring-up, but Master PDF §37 explicitly requires PostGIS for cadastral
-- overlay, spatial conflict detection (ST_Intersects, ST_DWithin), and
-- Scope Item 4 (GIS & geo-tagging). This restores that capability.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Convert project.alignment JSONB -> geometry(Geometry, 4326) if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'project' AND column_name = 'alignment' AND data_type = 'jsonb'
    ) THEN
        ALTER TABLE project ALTER COLUMN alignment TYPE geometry(Geometry, 4326)
            USING ST_GeomFromGeoJSON(alignment::text);
    END IF;
END $$;

-- Convert parcel.boundary JSONB -> geometry(Polygon, 4326) if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'parcel' AND column_name = 'boundary' AND data_type = 'jsonb'
    ) THEN
        ALTER TABLE parcel ALTER COLUMN boundary TYPE geometry(Polygon, 4326)
            USING ST_GeomFromGeoJSON(boundary::text);
    END IF;
END $$;

-- Convert parcel.centroid JSONB -> geometry(Point, 4326) if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'parcel' AND column_name = 'centroid' AND data_type = 'jsonb'
    ) THEN
        ALTER TABLE parcel ALTER COLUMN centroid TYPE geometry(Point, 4326)
            USING ST_GeomFromGeoJSON(centroid::text);
    END IF;
END $$;

-- (Re)create GiST spatial indexes — IF NOT EXISTS makes this safe to re-run
CREATE INDEX IF NOT EXISTS parcel_boundary_gix ON parcel USING GIST (boundary);
CREATE INDEX IF NOT EXISTS parcel_centroid_gix ON parcel USING GIST (centroid);
CREATE INDEX IF NOT EXISTS project_alignment_gix ON project USING GIST (alignment);
