-- Builder resumes now use ResumeBuilderProfile and child tables as the only
-- source of truth. Existing builder resumes may still contain legacy JSON
-- snapshots in ResumeVersion.content, so we intentionally remove them.

CREATE TEMP TABLE "_builder_resume_delete_candidates" ON COMMIT DROP AS
SELECT DISTINCT
  r."id",
  r."originalFileId",
  r."exportFileId"
FROM "Resume" r
WHERE EXISTS (
  SELECT 1
  FROM "ResumeVersion" rv
  WHERE rv."resumeId" = r."id"
    AND rv."source" = 'builder'
)
OR EXISTS (
  SELECT 1
  FROM "ResumeBuilderProfile" rbp
  WHERE rbp."resumeId" = r."id"
);

CREATE TEMP TABLE "_builder_file_delete_candidates" ON COMMIT DROP AS
SELECT DISTINCT "fileId"
FROM (
  SELECT "originalFileId" AS "fileId"
  FROM "_builder_resume_delete_candidates"
  WHERE "originalFileId" IS NOT NULL
  UNION
  SELECT "exportFileId" AS "fileId"
  FROM "_builder_resume_delete_candidates"
  WHERE "exportFileId" IS NOT NULL
) files;

DELETE FROM "Resume"
WHERE "id" IN (
  SELECT "id"
  FROM "_builder_resume_delete_candidates"
);

DELETE FROM "FileAsset" fa
WHERE fa."id" IN (
  SELECT "fileId"
  FROM "_builder_file_delete_candidates"
)
AND NOT EXISTS (
  SELECT 1
  FROM "Resume" r
  WHERE r."originalFileId" = fa."id"
     OR r."exportFileId" = fa."id"
);
