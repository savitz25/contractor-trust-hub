import unittest
from pathlib import Path
from ingest.monitoring import event_fingerprint, material_license_changes

class MonitoringTests(unittest.TestCase):
    def test_formatting_only_changes_suppressed(self):
        before={"primary_status":" C ","secondary_status":"a","status_normalized":"active","licensee_name_raw":"Acme  LLC","dba_name_raw":"Acme","address_line_1":"1 Main St","city":"Miami","state":"FL","postal_code":"33101","expiration_date":"2027-08-31"}
        after={**before,"primary_status":"c","status_normalized":" ACTIVE ","licensee_name_raw":"ACME LLC","address_line_1":"1  main st"}
        self.assertEqual([],material_license_changes(before,after))
    def test_material_change_and_fingerprint_determinism(self):
        before={"status_normalized":"active"};after={"status_normalized":"inactive"}
        changes=material_license_changes(before,after)
        self.assertEqual("LICENSE_STATUS_CHANGED",changes[0][0])
        args=dict(contractor_id="11111111-1111-4111-8111-111111111111",source_system="fl_dbpr",source_record_id="CBC123",change_type=changes[0][0],prior_state=changes[0][1],current_state=changes[0][2])
        self.assertEqual(event_fingerprint(**args),event_fingerprint(**args))
    def test_schema_is_additive_and_not_ranking_or_publication(self):
        sql=Path('schema/migrations/012_regulatory_change_events.sql').read_text()
        lowered=sql.lower()
        for forbidden in ('update licenses','update discipline_actions','update contractors','publication_state','search ranking'):
            self.assertNotIn(forbidden,lowered)

if __name__=='__main__':unittest.main()
