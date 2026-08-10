from datetime import datetime, timedelta, timezone

from li_harvester.models import Post, SeenPost
from li_harvester.runner import select_posts


def _post(url: str, days_ago: int, comments: int) -> Post:
    return Post(
        post_url=url,
        influencer_name="Inf",
        posted_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
        comment_count=comments,
        post_text="x",
    )


def test_select_drops_old_and_low_comments():
    posts = [
        _post("https://www.linkedin.com/posts/a", 40, 50),
        _post("https://www.linkedin.com/posts/b", 5, 5),
        _post("https://www.linkedin.com/posts/c", 5, 20),
    ]
    selected, updates = select_posts(posts, {})
    assert [p.post_url for p in selected] == ["https://www.linkedin.com/posts/c"]
    assert updates == []


def test_rescrape_delta():
    url = "https://www.linkedin.com/posts/d"
    seen = {
        url: SeenPost(post_url=url, first_scraped_at="2026-01-01", comment_count_at_scrape=10)
    }
    posts = [_post(url, 3, 35)]  # delta 25 >= 20, age < 14
    selected, updates = select_posts(posts, seen)
    assert len(selected) == 1
    assert updates[0].comment_count_at_scrape == 35


def test_no_rescrape_when_delta_small():
    url = "https://www.linkedin.com/posts/e"
    seen = {
        url: SeenPost(post_url=url, first_scraped_at="2026-01-01", comment_count_at_scrape=10)
    }
    posts = [_post(url, 3, 15)]
    selected, updates = select_posts(posts, seen)
    assert selected == []
    assert updates == []


def test_unknown_comment_count_kept():
    """Company actor often omits comment counts (-1)."""
    posts = [_post("https://www.linkedin.com/posts/f", 2, -1)]
    selected, _ = select_posts(posts, {})
    assert len(selected) == 1
