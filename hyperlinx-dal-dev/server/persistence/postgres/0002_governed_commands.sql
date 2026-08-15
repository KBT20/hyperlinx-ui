BEGIN;
SET ROLE hyperlinx_owner;
SET search_path TO hyperlinx, public;

CREATE OR REPLACE FUNCTION assert_active_membership(
  p_organization_id text,
  p_principal_id text,
  p_membership_id text
) RETURNS void
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE membership_id = p_membership_id
      AND organization_id = p_organization_id
      AND principal_id = p_principal_id
      AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'ACTOR_AUTHORITY_REJECTED' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION assert_permission(
  p_organization_id text,
  p_principal_id text,
  p_permission_key text
) RETURNS void
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM memberships membership
    JOIN assignments assignment ON assignment.membership_id=membership.membership_id
    JOIN role_permissions role_permission ON role_permission.role_id=assignment.role_id
    JOIN permissions permission ON permission.permission_id=role_permission.permission_id
    WHERE membership.organization_id=p_organization_id
      AND membership.principal_id=p_principal_id
      AND membership.status='ACTIVE'
      AND (permission.permission_key=p_permission_key OR permission.permission_key='platform.admin')
      AND assignment.effective_at <= clock_timestamp()
      AND (assignment.expires_at IS NULL OR assignment.expires_at > clock_timestamp())
  ) THEN
    RAISE EXCEPTION 'ACTOR_PERMISSION_REJECTED: %',p_permission_key USING ERRCODE='42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION save_opportunity_state(
  p_opportunity_id text,
  p_organization_id text,
  p_customer_id text,
  p_name text,
  p_description text,
  p_product_reference jsonb,
  p_lifecycle_state text,
  p_artifact_type text,
  p_artifact_id text,
  p_status text,
  p_commercial_state jsonb,
  p_expected_version bigint,
  p_principal_id text,
  p_membership_id text,
  p_idempotency_key text
) RETURNS opportunities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = hyperlinx, pg_temp
AS $$
DECLARE
  v_request_hash text;
  v_prior command_idempotency;
  v_saved opportunities;
BEGIN
  PERFORM assert_active_membership(p_organization_id, p_principal_id, p_membership_id);
  PERFORM assert_permission(p_organization_id, p_principal_id, 'opportunity.manage');
  v_request_hash := encode(public.digest(concat_ws('|', p_opportunity_id, p_customer_id, p_name,
    p_description, p_product_reference::text, p_lifecycle_state, p_artifact_type,
    p_artifact_id, p_status, p_commercial_state::text, p_expected_version), 'sha256'), 'hex');
  SELECT * INTO v_prior FROM command_idempotency
  WHERE organization_id=p_organization_id AND principal_id=p_principal_id
    AND command_type='SAVE_OPPORTUNITY' AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_prior.request_hash <> v_request_hash THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSE' USING ERRCODE='23505';
    END IF;
    SELECT * INTO v_saved FROM opportunities WHERE opportunity_id=p_opportunity_id;
    RETURN v_saved;
  END IF;

  UPDATE opportunities SET
    customer_id=p_customer_id,
    name=p_name,
    description=COALESCE(p_description,''),
    product_reference=COALESCE(p_product_reference,'{}'::jsonb),
    current_lifecycle_state=p_lifecycle_state,
    current_artifact_type=p_artifact_type,
    current_artifact_id=p_artifact_id,
    status=p_status,
    commercial_state=COALESCE(p_commercial_state,'{}'::jsonb),
    row_version=row_version+1,
    updated_at=clock_timestamp()
  WHERE opportunity_id=p_opportunity_id
    AND organization_id=p_organization_id
    AND row_version=p_expected_version
  RETURNING * INTO v_saved;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STALE_CONTEXT' USING ERRCODE='40001';
  END IF;

  INSERT INTO command_idempotency (
    organization_id, principal_id, command_type, idempotency_key, request_hash,
    response_status, response_body
  ) VALUES (
    p_organization_id, p_principal_id, 'SAVE_OPPORTUNITY', p_idempotency_key,
    v_request_hash, 200, to_jsonb(v_saved)
  );
  RETURN v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION clone_proposal_revision(
  p_source_revision_id text,
  p_new_revision_id text,
  p_expected_pointer_version bigint,
  p_principal_id text,
  p_membership_id text,
  p_idempotency_key text
) RETURNS proposal_revisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = hyperlinx, pg_temp
AS $$
DECLARE
  v_source proposal_revisions;
  v_pointer proposal_current_pointers;
  v_revision_number integer;
  v_request_hash text;
  v_prior command_idempotency;
  v_clone proposal_revisions;
BEGIN
  SELECT * INTO v_source FROM proposal_revisions
  WHERE proposal_revision_id=p_source_revision_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_PROPOSAL_REVISION_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  PERFORM assert_active_membership(v_source.organization_id, p_principal_id, p_membership_id);
  PERFORM assert_permission(v_source.organization_id, p_principal_id, 'proposal.manage');
  v_request_hash := encode(public.digest(concat_ws('|',p_source_revision_id,p_new_revision_id,p_expected_pointer_version), 'sha256'), 'hex');
  SELECT * INTO v_prior FROM command_idempotency
  WHERE organization_id=v_source.organization_id AND principal_id=p_principal_id
    AND command_type='CLONE_PROPOSAL' AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_prior.request_hash <> v_request_hash THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSE' USING ERRCODE='23505';
    END IF;
    SELECT * INTO v_clone FROM proposal_revisions WHERE proposal_revision_id=p_new_revision_id;
    RETURN v_clone;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('proposal:' || v_source.proposal_id, 0));
  SELECT * INTO v_pointer FROM proposal_current_pointers
  WHERE proposal_id=v_source.proposal_id FOR UPDATE;
  IF COALESCE(v_pointer.pointer_version,0) <> p_expected_pointer_version THEN
    RAISE EXCEPTION 'STALE_CONTEXT' USING ERRCODE='40001';
  END IF;
  SELECT COALESCE(max(revision_number),0)+1 INTO v_revision_number
  FROM proposal_revisions WHERE proposal_id=v_source.proposal_id;

  INSERT INTO proposal_revisions (
    proposal_revision_id, proposal_id, opportunity_id, organization_id,
    revision_number, parent_revision_id, status, commercial_state, content_hash,
    created_by, created_at
  ) VALUES (
    p_new_revision_id, v_source.proposal_id, v_source.opportunity_id, v_source.organization_id,
    v_revision_number, v_source.proposal_revision_id, 'WORKING', v_source.commercial_state,
    v_source.content_hash, p_principal_id, clock_timestamp()
  ) RETURNING * INTO v_clone;

  INSERT INTO proposal_current_pointers (
    proposal_id, proposal_revision_id, pointer_version, updated_by
  ) VALUES (v_source.proposal_id, v_clone.proposal_revision_id, 1, p_principal_id)
  ON CONFLICT (proposal_id) DO UPDATE SET
    proposal_revision_id=EXCLUDED.proposal_revision_id,
    pointer_version=proposal_current_pointers.pointer_version+1,
    updated_by=EXCLUDED.updated_by,
    updated_at=clock_timestamp();

  INSERT INTO command_idempotency (
    organization_id, principal_id, command_type, idempotency_key, request_hash,
    response_status, response_body
  ) VALUES (
    v_source.organization_id, p_principal_id, 'CLONE_PROPOSAL', p_idempotency_key,
    v_request_hash, 201, to_jsonb(v_clone)
  );
  RETURN v_clone;
END;
$$;

CREATE OR REPLACE FUNCTION append_governed_event(
  p_event_id text,
  p_event_type text,
  p_organization_id text,
  p_principal_id text,
  p_membership_id text,
  p_aggregate_type text,
  p_aggregate_id text,
  p_expected_version bigint,
  p_scope_version_id text,
  p_redline_revision_id text,
  p_object_id text,
  p_discipline text,
  p_action text,
  p_from_state text,
  p_to_state text,
  p_place_reference jsonb,
  p_source_authority text,
  p_source_artifact_id text,
  p_source_revision text,
  p_source_hash text,
  p_preceding_event_id text,
  p_effective_at timestamptz,
  p_evidence_reference jsonb,
  p_idempotency_key text
) RETURNS governed_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = hyperlinx, pg_temp
AS $$
DECLARE
  v_existing governed_events;
  v_last governed_events;
  v_projection object_current_state;
  v_current_version bigint;
  v_next_version bigint;
  v_hash text;
  v_event governed_events;
BEGIN
  PERFORM assert_active_membership(p_organization_id, p_principal_id, p_membership_id);
  SELECT * INTO v_existing FROM governed_events
  WHERE organization_id=p_organization_id AND principal_id=p_principal_id
    AND idempotency_key=p_idempotency_key;
  IF FOUND THEN RETURN v_existing; END IF;
  IF p_redline_revision_id IS NOT NULL AND p_scope_version_id IS NULL THEN
    RAISE EXCEPTION 'REDLINE_REQUIRES_SCOPEVERSION' USING ERRCODE='23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id || ':' || p_aggregate_type || ':' || p_aggregate_id, 0));
  SELECT * INTO v_last FROM governed_events
  WHERE organization_id=p_organization_id AND aggregate_type=p_aggregate_type
    AND aggregate_id=p_aggregate_id
  ORDER BY aggregate_version DESC LIMIT 1;
  v_current_version := COALESCE(v_last.aggregate_version,0);
  v_next_version := v_current_version+1;
  IF p_expected_version IS DISTINCT FROM v_current_version THEN
    RAISE EXCEPTION 'STALE_CONTEXT: expected %, current %',p_expected_version,v_current_version USING ERRCODE='40001';
  END IF;
  IF p_preceding_event_id IS DISTINCT FROM v_last.event_id THEN
    RAISE EXCEPTION 'STALE_CONTEXT: preceding event mismatch' USING ERRCODE='40001';
  END IF;
  IF v_last.to_state IS NOT NULL AND p_from_state IS DISTINCT FROM v_last.to_state THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: from_state mismatch' USING ERRCODE='23514';
  END IF;
  IF p_object_id IS NOT NULL THEN
    SELECT * INTO v_projection FROM object_current_state
    WHERE organization_id=p_organization_id AND object_id=p_object_id FOR UPDATE;
    IF FOUND AND (v_projection.current_event_id IS DISTINCT FROM v_last.event_id
      OR v_projection.projection_version IS DISTINCT FROM v_current_version) THEN
      RAISE EXCEPTION 'REPLAY_INTEGRITY_FAILURE' USING ERRCODE='XX001';
    END IF;
  END IF;

  v_hash := encode(public.digest(concat_ws('|',p_event_id,p_event_type,p_organization_id,p_principal_id,
    p_aggregate_type,p_aggregate_id,v_next_version,p_scope_version_id,p_redline_revision_id,
    p_object_id,p_discipline,p_action,p_from_state,p_to_state,p_source_authority,
    p_source_artifact_id,p_source_revision,p_source_hash,p_preceding_event_id,
    p_effective_at::text,COALESCE(p_place_reference,'{}'::jsonb)::text,
    COALESCE(p_evidence_reference,'{}'::jsonb)::text),'sha256'),'hex');

  INSERT INTO governed_events (
    event_id,event_type,organization_id,principal_id,membership_id,aggregate_type,
    aggregate_id,aggregate_version,scope_version_id,redline_revision_id,object_id,
    discipline,action,from_state,to_state,place_reference,source_authority,
    source_artifact_id,source_revision,source_hash,preceding_event_id,effective_at,
    evidence_reference,event_hash,idempotency_key
  ) VALUES (
    p_event_id,p_event_type,p_organization_id,p_principal_id,p_membership_id,p_aggregate_type,
    p_aggregate_id,v_next_version,p_scope_version_id,p_redline_revision_id,p_object_id,
    p_discipline,p_action,p_from_state,p_to_state,COALESCE(p_place_reference,'{}'::jsonb),
    p_source_authority,p_source_artifact_id,p_source_revision,p_source_hash,
    p_preceding_event_id,p_effective_at,COALESCE(p_evidence_reference,'{}'::jsonb),
    v_hash,p_idempotency_key
  ) RETURNING * INTO v_event;

  IF p_object_id IS NOT NULL THEN
    INSERT INTO object_current_state (
      organization_id,object_id,scope_version_id,current_state,current_event_id,effective_at,projection_version
    ) VALUES (
      p_organization_id,p_object_id,p_scope_version_id,p_to_state,p_event_id,p_effective_at,v_next_version
    ) ON CONFLICT (organization_id,object_id) DO UPDATE SET
      scope_version_id=EXCLUDED.scope_version_id,
      current_state=EXCLUDED.current_state,
      current_event_id=EXCLUDED.current_event_id,
      effective_at=EXCLUDED.effective_at,
      projection_version=EXCLUDED.projection_version;
  END IF;
  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION assert_active_membership(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION assert_permission(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_opportunity_state(text,text,text,text,text,jsonb,text,text,text,text,jsonb,bigint,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION clone_proposal_revision(text,text,bigint,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION append_governed_event(text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,timestamptz,jsonb,text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION save_opportunity_state(text,text,text,text,text,jsonb,text,text,text,text,jsonb,bigint,text,text,text) TO hyperlinx_app;
GRANT EXECUTE ON FUNCTION clone_proposal_revision(text,text,bigint,text,text,text) TO hyperlinx_app;
GRANT EXECUTE ON FUNCTION append_governed_event(text,text,text,text,text,text,text,bigint,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,timestamptz,jsonb,text) TO hyperlinx_app;

INSERT INTO schema_migrations (migration_id,content_hash)
VALUES ('0002_governed_commands',encode(digest('CIP-058 governed commands v1','sha256'),'hex'))
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
