BEGIN;
SET ROLE hyperlinx_owner;

CREATE OR REPLACE FUNCTION hyperlinx.proposal_revision_diff(p_left_id text, p_right_id text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH revisions AS (
    SELECT proposal_revision_id, commercial_state
    FROM hyperlinx.proposal_revisions
    WHERE proposal_revision_id IN (p_left_id, p_right_id)
  ), left_values AS (
    SELECT key, value FROM jsonb_each((SELECT commercial_state FROM revisions WHERE proposal_revision_id = p_left_id))
  ), right_values AS (
    SELECT key, value FROM jsonb_each((SELECT commercial_state FROM revisions WHERE proposal_revision_id = p_right_id))
  ), keys AS (
    SELECT key FROM left_values UNION SELECT key FROM right_values
  )
  SELECT COALESCE(jsonb_object_agg(keys.key, jsonb_build_object('before', left_values.value, 'after', right_values.value)), '{}'::jsonb)
  FROM keys
  LEFT JOIN left_values USING (key)
  LEFT JOIN right_values USING (key)
  WHERE left_values.value IS DISTINCT FROM right_values.value;
$$;

INSERT INTO hyperlinx.schema_migrations (migration_id,content_hash)
VALUES ('0003_diff_resolution',encode(public.digest('CIP-058 proposal diff resolution v1','sha256'),'hex'))
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
