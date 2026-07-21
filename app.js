const form = document.getElementById("lookup-form");
const usernameInput = document.getElementById("username");
const status = document.getElementById("status");
const results = document.getElementById("results");

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function setLoading(isLoading) {
  const button = form.querySelector("button");
  button.disabled = isLoading;
  usernameInput.disabled = isLoading;
}

function summarizeTournamentProgress(tournament) {
  const rounds = tournament.rounds || [];

  if (!rounds.length) {
    return {
      label: "No round data available",
      percent: 0,
      remaining: null,
      finished: null,
      total: null,
      tone: "muted",
    };
  }

  const latestRound = rounds.reduce((best, round) => {
    const bestNumber = best?.round_number || 0;
    const roundNumber = round?.round_number || 0;
    return roundNumber > bestNumber ? round : best;
  }, rounds[0]);

  const total = latestRound?.total_matches || 0;
  const finished = latestRound?.finished_matches || 0;

  if (!total) {
    return {
      label: `Round ${latestRound?.round_number || "?"}: no matches yet`,
      percent: 0,
      remaining: 0,
      finished,
      total,
      tone: "muted",
    };
  }

  const percent = Math.min(100, Math.max(0, (finished / total) * 100));
  const remaining = Math.max(0, total - finished);

  return {
    label: `Round ${latestRound?.round_number || "?"}: ${finished}/${total} finished`,
    percent,
    remaining,
    finished,
    total,
    tone: percent >= 100 ? "complete" : percent >= 50 ? "progress" : "start",
  };
}

function renderResults(username, tournaments) {
  results.classList.add("visible");

  if (!tournaments.length) {
    results.innerHTML = `
      <p class="empty-state">${username} is not listed in any public tournaments.</p>
    `;
    return;
  }

  results.innerHTML = `
    <div class="results-header">
      <h2>${tournaments.length} public tournament${tournaments.length === 1 ? "" : "s"} found</h2>
      <p>for ${username}</p>
    </div>
    <ul class="tournament-list">
      ${tournaments
        .map((tournament) => {
          const id = tournament.id;
          const name = tournament.name || `Tournament ${id}`;
          const progress = summarizeTournamentProgress(tournament);

          return `
            <li class="tournament-item">
              <div class="tournament-copy">
                <strong>${name}</strong>
                <div class="progress-meta ${progress.tone}">
                  <span>${progress.label}</span>
                  <span>${progress.remaining === null ? "" : `${progress.remaining} game${progress.remaining === 1 ? "" : "s"} left`}</span>
                </div>
                <div class="progress-track" aria-hidden="true">
                  <div class="progress-fill ${progress.tone}" style="width: ${progress.percent}%"></div>
                </div>
              </div>
              <a href="https://online-go.com/tournament/${id}" target="_blank" rel="noreferrer">Open OGS</a>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

async function fetchTournamentDetails(tournament) {
  const details = await fetchJson(`https://online-go.com/api/v1/tournaments/${tournament.id}`);
  return {
    ...tournament,
    ...details,
  };
}

async function loadTournamentProgress(tournaments) {
  return Promise.all(tournaments.map((tournament) => fetchTournamentDetails(tournament)));
}

async function lookupTournaments(rawUsername) {
  const username = rawUsername.trim();
  if (!username) {
    setStatus("Enter an OGS username.", true);
    return;
  }

  setLoading(true);
  setStatus(`Looking up ${username}...`);
  results.classList.remove("visible");
  results.innerHTML = "";

  try {
    const players = await fetchJson(
      `https://online-go.com/api/v1/players?username=${encodeURIComponent(username)}`
    );
    const user = players.results?.[0];

    if (!user) {
      setStatus(`No OGS user found for ${username}.`, true);
      return;
    }

    const profile = await fetchJson(
      `https://online-go.com/api/v1/players/${user.id}/full`
    );
    const tournaments = profile.tournaments || [];
    const detailedTournaments = await loadTournamentProgress(tournaments);

    setStatus(`Found ${detailedTournaments.length} public tournament${detailedTournaments.length === 1 ? "" : "s"} for ${user.username}.`);
    renderResults(user.username, detailedTournaments);
  } catch (error) {
    setStatus(`Could not fetch tournaments. ${error.message}`, true);
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  lookupTournaments(usernameInput.value);
});

usernameInput.focus();