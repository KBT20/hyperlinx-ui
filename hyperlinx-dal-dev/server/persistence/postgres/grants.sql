\set ON_ERROR_STOP on

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA hyperlinx FROM PUBLIC;

GRANT USAGE ON SCHEMA hyperlinx TO hyperlinx_app;
GRANT USAGE ON SCHEMA public TO hyperlinx_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO hyperlinx_app;
GRANT SELECT ON ALL TABLES IN SCHEMA hyperlinx TO hyperlinx_app;
GRANT INSERT, UPDATE ON hyperlinx.personal_state TO hyperlinx_app;
GRANT INSERT, UPDATE ON hyperlinx.opportunities TO hyperlinx_app;
GRANT INSERT ON hyperlinx.proposals, hyperlinx.proposal_revisions TO hyperlinx_app;
GRANT INSERT, UPDATE ON hyperlinx.proposal_current_pointers TO hyperlinx_app;
GRANT INSERT ON hyperlinx.governed_artifacts, hyperlinx.scope_versions,
  hyperlinx.redline_revisions, hyperlinx.evidence_references TO hyperlinx_app;
GRANT INSERT, UPDATE ON hyperlinx.artifact_current_pointers TO hyperlinx_app;
GRANT INSERT ON hyperlinx.places, hyperlinx.object_place_relationships TO hyperlinx_app;
GRANT INSERT, UPDATE ON hyperlinx.repository_records TO hyperlinx_app;
GRANT SELECT ON hyperlinx.replay_integrity TO hyperlinx_app;
GRANT EXECUTE ON FUNCTION hyperlinx.append_governed_event(
  text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,jsonb,
  text,text,text,text,text,timestamptz,jsonb,text
) TO hyperlinx_app;
GRANT EXECUTE ON FUNCTION hyperlinx.proposal_revision_diff(text,text) TO hyperlinx_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA hyperlinx GRANT SELECT ON TABLES TO hyperlinx_app;
