from li_harvester.normalize import (
    collapse_comment,
    company_identifier,
    is_company_url,
    normalize_company_url,
    normalize_linkedin_url,
    normalize_post_url,
    split_name,
    word_count,
)


def test_normalize_linkedin_basic():
    assert (
        normalize_linkedin_url("https://www.linkedin.com/in/Jane-Doe-12345/")
        == "https://www.linkedin.com/in/jane-doe-12345"
    )


def test_normalize_linkedin_locale_and_query():
    assert (
        normalize_linkedin_url("https://de.linkedin.com/in/blake-smith/?trk=public")
        == "https://www.linkedin.com/in/blake-smith"
    )


def test_normalize_linkedin_rejects_company():
    assert normalize_linkedin_url("https://www.linkedin.com/company/acme") is None


def test_normalize_post_url_strips_query():
    url = normalize_post_url(
        "https://www.linkedin.com/posts/foo-activity-123?utm_source=share"
    )
    assert url == "https://www.linkedin.com/posts/foo-activity-123"


def test_split_name_credentials_and_emoji():
    assert split_name("Chris Moore CFA, MBA") == ("Chris", "Moore")
    first, last = split_name("Jamie (He/Him) | Trader 🚀")
    assert first == "Jamie"
    assert last == ""


def test_split_name_single_token():
    assert split_name("Alex") == ("Alex", "")


def test_word_count_strips_noise():
    assert word_count("Great post! 🔥 @someone") == 2
    assert word_count("One two three four") == 4


def test_collapse_comment():
    assert collapse_comment("hello\n\nworld") == "hello world"
    assert len(collapse_comment("x" * 2000)) == 1000


def test_company_url():
    url = "https://www.linkedin.com/company/wall-street-oasis/posts/"
    assert is_company_url(url) is True
    assert (
        normalize_company_url(url) == "https://www.linkedin.com/company/wall-street-oasis"
    )
    assert company_identifier(url) == "wall-street-oasis"


def test_school_posts_feed_url():
    url = "https://www.linkedin.com/school/cmf-ynvrsty/posts/?feedView=all"
    assert is_company_url(url) is True
    assert normalize_company_url(url) == "https://www.linkedin.com/school/cmf-ynvrsty"
    assert company_identifier(url) == "cmf-ynvrsty"
