-- FL15-ENRICH-001 rollback: this batch only
DELETE FROM contractor_enrichment_observations WHERE source_system = 'workbook_contact_enrich_fl15_2026_10' AND batch_id = 'fl15-enrich-001-2026-10-22';
