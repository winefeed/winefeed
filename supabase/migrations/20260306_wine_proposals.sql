-- Wine Proposals: public outreach pages for restaurants
-- Allows admin to create a proposal with selected wines,
-- share a link, and collect interest responses.

CREATE TABLE wine_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name TEXT NOT NULL,
  restaurant_city TEXT,
  message TEXT,
  created_by UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE wine_proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES wine_proposals(id) ON DELETE CASCADE,
  supplier_wine_id UUID NOT NULL REFERENCES supplier_wines(id),
  reason TEXT,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX idx_proposal_items_proposal ON wine_proposal_items(proposal_id);

CREATE TABLE wine_proposal_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES wine_proposals(id),
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  message TEXT,
  interested_wine_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wine_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE wine_proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wine_proposal_responses ENABLE ROW LEVEL SECURITY;
