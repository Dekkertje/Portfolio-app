-- Add match_method column to ticker_mappings table

ALTER TABLE public.ticker_mappings 
ADD COLUMN IF NOT EXISTS match_method TEXT;

-- Add comment
COMMENT ON COLUMN public.ticker_mappings.match_method IS 'How ticker was matched: exact_isin, fuzzy_name, manual, approved_mapping, no_match';

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ticker_mappings' 
ORDER BY ordinal_position;
