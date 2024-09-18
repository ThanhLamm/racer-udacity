/**
 * Global store to hold race-related data.
 * @type {Object}
 */
let raceData = {
  selectedTrackId: undefined,
  selectedTrackName: undefined,
  selectedPlayerId: undefined,
  selectedPlayerName: undefined,
  currentRaceId: undefined,
};

// Base server URL
const SERVER = "http://localhost:3001";

/**
 * Initialize page by loading data and setting up event handlers.
 */
document.addEventListener("DOMContentLoaded", async () => {
  await initializePage();
  setupEventListeners();
});

/**
 * Initialize page by loading data.
 */
async function initializePage() {
  console.log("Initializing page...");

  // Fetch and render data if not on the home page
  if (window.location.pathname !== "/") {
    try {
      const [tracks, racers] = await Promise.all([
        fetchData("/api/tracks"),
        fetchData("/api/cars")
      ]);

      renderAt("#tracks", renderTrackCards(tracks));
      renderAt("#racers", renderRacerCards(racers));
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }
}

/**
 * Set up event listeners for user interactions.
 */
function setupEventListeners() {
  document.addEventListener("click", async (event) => {
    const { target } = event;

    if (target.matches(".card.track")) {
      handleSelection(target, "#tracks");
      raceData.selectedTrackId = target.id;
      raceData.selectedTrackName = target.innerHTML;
    }

    if (target.matches(".card.racer")) {
      handleSelection(target, "#racers");
      raceData.selectedPlayerId = target.id;
      raceData.selectedPlayerName = target.innerHTML;
    }

    if (target.matches("#submit-create-race")) {
      event.preventDefault();
      await handleRaceCreation();
    }

    if (target.matches("#gas-peddle")) {
      await handleRaceAcceleration();
    }

    console.log("Race data updated:", raceData);
  });
}

/**
 * Handle selection of track or racer and highlight the selected item.
 * @param {HTMLElement} target - The selected element.
 * @param {string} containerSelector - The selector of the container to remove selection from.
 */
function handleSelection(target, containerSelector) {
  document.querySelector(`${containerSelector} .selected`)?.classList.remove("selected");
  target.classList.add("selected");
}

/**
 * Delay execution for a given number of milliseconds.
 * @param {number} ms - The delay time in milliseconds.
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Handle race creation, including validation, starting the countdown, and running the race.
 * @async
 */
async function handleRaceCreation() {
  console.log("Creating race...");
  const { selectedPlayerId, selectedTrackId } = raceData;

  if (!selectedPlayerId || !selectedTrackId) {
    renderAt("#error", '<h2 class="error">Please select Track and Racer</h2>');
    return;
  }

  try {
    const race = await createRace(selectedPlayerId, selectedTrackId);
    raceData.currentRaceId = parseInt(race.ID);
    renderAt("#race", renderRaceStartView(raceData.selectedTrackName));

    await runCountdown();
    await startRace(raceData.currentRaceId);
    await monitorRace(raceData.currentRaceId);
  } catch (error) {
    renderAt("#error", `<h2 class="error">${error.message}</h2>`);
  }
}

/**
 * Monitor the race progress and update the leaderboard.
 * @param {number} raceId - The ID of the race to monitor.
 * @returns {Promise<Object>}
 * @async
 */
async function monitorRace(raceId) {
  return new Promise(resolve => {
    const raceInterval = setInterval(async () => {
      const raceData = await fetchData(`/api/races/${raceId}`);
      if (raceData.status === "in-progress") {
        renderAt("#leaderBoard", generateRaceProgress(raceData.positions));
      } else if (raceData.status === "finished") {
        clearInterval(raceInterval);
        renderAt("#race", generateResultsView(raceData.positions));
        resolve(raceData);
      }
    }, 500);
  });
}

/**
 * Start the countdown before the race begins.
 * @async
 */
async function runCountdown() {
  try {
    await delay(500);
    let countdownTimer = 5;

    return new Promise(resolve => {
      const countdownInterval = setInterval(() => {
        if (countdownTimer > 0) {
          document.getElementById("big-numbers").innerText = --countdownTimer;
        } else {
          clearInterval(countdownInterval);
          document.getElementById("race-instructions").innerText = "Race Ready!";
          const raceButton = document.getElementById("gas-peddle");
          raceButton.innerText = "Start Race!";
          raceButton.disabled = false;
          resolve();
        }
      }, 1000);
    });
  } catch (error) {
    console.error("Countdown error:", error);
  }
}

/**
 * Handle race acceleration.
 */
async function handleRaceAcceleration() {
  await accelerateRace(raceData.currentRaceId);
}

/**
 * Generate HTML for racer cards.
 * @param {Array<Object>} racers - The list of racers.
 * @returns {string}
 */
function renderRacerCards(racers) {
  return racers.length
    ? `<ul id="racers">${racers.map(renderRacerCard).join("")}</ul>`
    : "<h4>Loading Racers...</h4>";
}

/**
 * Generate HTML for track cards.
 * @param {Array<Object>} tracks - The list of tracks.
 * @returns {string}
 */
function renderTrackCards(tracks) {
  return tracks.length
    ? `<ul id="tracks">${tracks.map(renderTrackCard).join("")}</ul>`
    : "<h4>Loading Tracks...</h4>";
}

/**
 * Fetch data from the server.
 * @param {string} endpoint - The API endpoint.
 * @returns {Promise<Object>}
 * @async
 */
async function fetchData(endpoint) {
  try {
    const response = await fetch(`${SERVER}${endpoint}`, defaultFetchOptions());
    return response.json();
  } catch (error) {
    console.error(`Error fetching data from ${endpoint}:`, error);
  }
}

/**
 * Create a new race with the selected player and track.
 * @param {number} playerId - The ID of the selected player.
 * @param {number} trackId - The ID of the selected track.
 * @returns {Promise<Object>}
 * @async
 */
async function createRace(playerId, trackId) {
  const requestBody = JSON.stringify({ player_id: parseInt(playerId), track_id: parseInt(trackId) });
  return fetch(`${SERVER}/api/races`, {
    method: "POST",
    ...defaultFetchOptions(),
    body: requestBody,
  }).then(response => response.json());
}

/**
 * Start a race with the given ID.
 * @param {number} raceId - The ID of the race to start.
 * @returns {Promise<void>}
 * @async
 */
async function startRace(raceId) {
  return fetch(`${SERVER}/api/races/${raceId}/start`, {
    method: "POST",
    ...defaultFetchOptions(),
  });
}

/**
 * Accelerate the race with the given ID.
 * @param {number} raceId - The ID of the race to accelerate.
 * @returns {Promise<void>}
 * @async
 */
async function accelerateRace(raceId) {
  return fetch(`${SERVER}/api/races/${raceId}/accelerate`, {
    method: "POST",
    ...defaultFetchOptions(),
  });
}

/**
 * Default fetch options for API requests.
 * @returns {Object}
 */
function defaultFetchOptions() {
  return {
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": SERVER,
    },
  };
}

/**
 * Generate HTML for a single racer card.
 * @param {Object} racer - The racer object.
 * @returns {string}
 */
function renderRacerCard(racer) {
  return `
    <div class="card mb-3" id="${racer.id}">
      <div class="card-body">
        <h4 class="card-title card racer" id="${racer.id}">${racer.driver_name}</h4>
        <p class="card-text"><strong>Top Speed:</strong> ${racer.top_speed}</p>
        <p class="card-text"><strong>Acceleration:</strong> ${racer.acceleration}</p>
        <p class="card-text"><strong>Handling:</strong> ${racer.handling}</p>
      </div>
    </div>
  `;
}

/**
 * Generate HTML for a single track card.
 * @param {Object} track - The track object.
 * @returns {string}
 */
function renderTrackCard(track) {
  return `<h4 class="card track" id="${track.id}">${track.name}</h4>`;
}

/**
 * Generate HTML for the race start view.
 * @param {string} trackName - The name of the selected track.
 * @returns {string}
 */
function renderRaceStartView(trackName) {
  return `
    <header>
      <h1>Race: ${trackName}</h1>
    </header>
    <main id="two-columns">
      <section id="leaderBoard">${generateCountdown(5)}</section>
      <section id="accelerate">
        <div id="race-progress-container" class="d-flex justify-content-between align-items-center">
          <div>
            <h2>Directions</h2>
            <p id="race-instructions">Waiting for race to start...</p>
          </div>
          <button id="gas-peddle" class="btn btn-lg btn-primary rounded-circle custom-race-btn" disabled>
            Waiting...
          </button>
        </div>
      </section>
    </main>
  `;
}

/**
 * Generate HTML for the countdown display.
 * @param {number} count - The countdown start number.
 * @returns {string}
 */
function generateCountdown(count) {
  return `<h2>Race Starts In...</h2><p id="big-numbers">${count}</p>`;
}

/**
 * Render HTML content to a specified element.
 * @param {string} selector - The CSS selector of the element.
 * @param {string} html - The HTML content to render.
 */
function renderAt(selector, html) {
  const element = document.querySelector(selector);
  if (element) {
    element.innerHTML = html;
  } else {
    console.error(`Element with selector "${selector}" not found.`);
  }
}

/**
 * Generate HTML for the race results view.
 * @param {Array<Object>} positions - The race positions of all racers.
 * @returns {string}
 */
function generateResultsView(positions) {
  positions.sort((a, b) => a.final_position - b.final_position);
  return `
    <header class="bg-dark text-white text-center py-4">
      <h1>Race Results</h1>
    </header>
    <main class="container my-5">
      <div class="row">
        <div class="col-md-12">
          <h3 class="text-center mb-4">Final Standings:</h3>
          ${generateRaceProgress(positions)}
          <div class="text-center mt-4">
            <a href="/race" class="btn btn-primary btn-lg">Start a New Race</a>
          </div>
        </div>
      </div>
    </main>
  `;
}

/**
 * Generate HTML for the race progress leaderboard.
 * @param {Array<Object>} positions - The race positions of all racers.
 * @returns {string}
 */
function generateRaceProgress(positions) {
  // Find the user's racer and append "(you)" to their name
  const userRacer = positions.find(e => e.id === parseInt(raceData.selectedPlayerId));
  if (userRacer) userRacer.driver_name += " (you)";

  // Sort racers by progress
  positions.sort((a, b) => b.segment - a.segment);
  const leaderboard = positions.map((p, index) => `
    <tr>
      <td>
        <h3>${index + 1} - ${p.driver_name}</h3>
      </td>
    </tr>
  `);

  return `
    <table>
      <h2>Leaderboard</h2>
      ${leaderboard.join("")}
    </table>
  `;
}
