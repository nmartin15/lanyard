from li_harvester.filters import drop_people_icp_title


def test_icp_keeps_investing_seats():
    assert drop_people_icp_title("Research Analyst at Millennium") is None
    assert drop_people_icp_title("Portfolio Manager") is None
    assert drop_people_icp_title("PM at Millennium Management") is None
    assert drop_people_icp_title("Quantitative Researcher") is None
    assert drop_people_icp_title("Equity Trader") is None
    assert drop_people_icp_title("Market Risk Analyst") is None


def test_icp_drops_admin_and_non_seats():
    assert drop_people_icp_title("Executive Assistant") == "headline:admin"
    assert drop_people_icp_title("Office Manager") == "headline:admin"
    assert drop_people_icp_title("VP of Finance") == "headline:admin"
    assert drop_people_icp_title("Head of India at Point72") == "headline:not_icp"
    assert drop_people_icp_title("Manager at Point72") == "headline:not_icp"
