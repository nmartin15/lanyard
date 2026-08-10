from li_harvester.enrich import apply_enrichment_results, map_email_status
from li_harvester.models import Lead


def _lead(lead_id: str = "L-00001") -> Lead:
    return Lead(
        lead_id=lead_id,
        date_added="2026-08-09",
        influencer="Inf",
        post_url="https://www.linkedin.com/posts/x",
        trigger_comment="hello world this is a real comment",
        first_name="Jordan",
        last_name="Whitfield",
        linkedin_url="https://www.linkedin.com/in/jordan-whitfield",
    )


def test_map_email_status():
    assert map_email_status("deliverable", "a@b.com") == "Valid"
    assert map_email_status("catch_all_safe", "a@b.com") == "Catch-All"
    assert map_email_status("undeliverable", "a@b.com") == "Invalid"
    assert map_email_status(None, None) == "Not Found"


def test_apply_enrichment_results_by_custom_uuid():
    lead = _lead()
    result = {
        "credits_consumed": 1,
        "data": [
            {
                "enriched": True,
                "contact_email_address": "jordan@gmail.com",
                "contact_email_address_status": "deliverable",
                "custom_fields": {"uuid": "L-00001"},
            }
        ],
    }
    credits = apply_enrichment_results([lead], result)
    assert credits == 1
    assert lead.email == "jordan@gmail.com"
    assert lead.email_status == "Valid"


def test_apply_enrichment_not_found():
    lead = _lead()
    result = {
        "credits_consumed": 0,
        "data": [
            {
                "enriched": False,
                "custom_fields": {"uuid": "L-00001"},
            }
        ],
    }
    apply_enrichment_results([lead], result)
    assert lead.email is None
    assert lead.email_status == "Not Found"
