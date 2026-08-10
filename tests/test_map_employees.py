from li_harvester.apify import map_employees


def test_map_employees_normalizes_and_dedupes():
    items = [
        {
            "full_name": "Jane Doe, CFA",
            "headline": "Software Engineer at HRT",
            "profile_url": "https://www.linkedin.com/in/JaneDoe/",
            "location": "New York, NY",
        },
        {
            "name": "Jane Doe",
            "title": "dup",
            "profileUrl": "https://www.linkedin.com/in/janedoe/?trk=1",
        },
        {
            "profile": {
                "name": "John Smith",
                "headline": "Quant Researcher",
                "profile_url": "https://www.linkedin.com/in/john-smith",
            },
            "location": "London",
        },
        {
            "first_name": "Ray",
            "last_name": "Z.",
            "headline": "Algorithm Developer at Hudson River Trading",
            "profile_url": "https://linkedin.com/in/oneraynyday",
            "location": {
                "full": "San Francisco, California, United States",
                "city": "San Francisco, California",
            },
        },
        {"name": "No URL Person", "headline": "x"},
    ]
    people = map_employees(
        items,
        firm_name="Hudson River Trading",
        company_url="https://www.linkedin.com/company/hudson-river-trading/",
        date_added="2026-08-10",
    )
    assert len(people) == 3
    assert people[0].first_name == "Jane"
    assert people[0].linkedin_url == "https://www.linkedin.com/in/janedoe"
    assert people[0].firm_name == "Hudson River Trading"
    assert people[1].linkedin_url == "https://www.linkedin.com/in/john-smith"
    assert people[1].headline == "Quant Researcher"
    assert people[2].linkedin_url == "https://www.linkedin.com/in/oneraynyday"
    assert people[2].location == "San Francisco, California, United States"
