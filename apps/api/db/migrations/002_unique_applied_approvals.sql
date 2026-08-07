CREATE UNIQUE INDEX IF NOT EXISTS issue_approvals_one_active_per_analysis_idx
  ON issue_approvals (issue_id, analysis_id)
  WHERE status IN ('approved', 'applied');
