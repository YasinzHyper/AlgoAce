from tools import extract_json_str


def test_parses_plain_json():
    assert extract_json_str('  {"company": "google", "roadmap_data": []}\n') == {
        "company": "google",
        "roadmap_data": [],
    }


def test_parses_json_inside_a_fenced_block():
    reply = 'Here is your roadmap:\n```json\n{"roadmap_data": [{"week": 1}]}\n```\nGood luck!'

    assert extract_json_str(reply) == {"roadmap_data": [{"week": 1}]}


def test_parses_a_fenced_block_that_is_never_closed():
    reply = '```json\n{"roadmap_data": [{"week": 2}]}'

    assert extract_json_str(reply) == {"roadmap_data": [{"week": 2}]}


def test_returns_an_error_for_invalid_json():
    result = extract_json_str('{"company": "google" "roadmap_data": []}')

    assert set(result) == {"error"}
    assert result["error"].startswith("Invalid JSON: ")


def test_returns_an_error_when_the_reply_is_not_text():
    result = extract_json_str(None)

    assert set(result) == {"error"}
    assert result["error"].startswith("Failed to process roadmap: ")
