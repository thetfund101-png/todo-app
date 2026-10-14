ALTER TABLE weekly_plans
  ADD COLUMN plan_items JSON NULL AFTER plans;
