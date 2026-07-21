import requests
import argparse
from textwrap import dedent


def normalize_tournament_id(tour_id):
    return str(tour_id).strip()

def fetch_tournament_info(tour_id):
    url = f"https://online-go.com/api/v1/tournaments/{tour_id}"
    response = requests.get(url)
    if response.status_code != 200:
        print(f"❌ Failed to fetch tournament {tour_id}. Status {response.status_code}")
        return

    data = response.json()
    name = data.get("name", "Unknown Tournament")
    rounds = data.get("rounds", [])

    print(f"\n📖 {name} (ID: {tour_id})")

    if not rounds:
        print("   ⚠️ No round data available.")
        return

    max_round = max(rounds, key=lambda r: r.get("round_number", 0))
    total_matches = max_round.get("total_matches", 0)
    finished_matches = max_round.get("finished_matches", 0)

    if total_matches > 0:
        percent_done = finished_matches / total_matches * 100
        games_remaining = total_matches - finished_matches
        print(f"   Round {max_round.get('round_number', '?')}: {finished_matches}/{total_matches} finished "
              f"({percent_done:.2f}% done, {games_remaining} remaining)")
    else:
        print("   ⚠️ Round has zero matches.")


def resolve_user(username):
    response = requests.get(
        "https://online-go.com/api/v1/players",
        params={"username": username},
        timeout=10,
    )
    if response.status_code != 200:
        print(f"❌ Failed to find user {username}. Status {response.status_code}")
        return None

    results = response.json().get("results", [])
    if not results:
        print(f"⚠️ No OGS user found for username {username}.")
        return None

    return results[0]


def sync_user_tournaments(username):
    user = resolve_user(username)
    if not user:
        return

    user_id = user.get("id")
    response = requests.get(f"https://online-go.com/api/v1/players/{user_id}/full", timeout=10)
    if response.status_code != 200:
        print(f"❌ Failed to fetch tournaments for {username}. Status {response.status_code}")
        return

    data = response.json()
    tournaments = data.get("tournaments", [])
    if not tournaments:
        print(f"ℹ️ {username} is not listed in any public tournaments.")
        return

    print(f"📥 Found {len(tournaments)} public tournaments for {user.get('username', username)}:")
    for tournament in tournaments:
        tour_id = normalize_tournament_id(tournament.get("id"))
        fetch_tournament_info(tour_id)

    print(f"✅ Listed {len(tournaments)} tournament(s) for {username}.")

def main():
    parser = argparse.ArgumentParser(
        description="List public OGS tournaments for a username",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=dedent("""
        Usage:
          python tournament_cli.py <ogs_username>
        """)
    )
    parser.add_argument("username", help="OGS username to look up")

    args = parser.parse_args()
    sync_user_tournaments(args.username)


if __name__ == "__main__":
    main()
