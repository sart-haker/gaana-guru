/* ====== BOLLYWOOD SONG DATABASE ======
   Add "audio" URLs (your own hosted clips or legal previews) to enable sound.
   Deezer search supplies previews and album artwork for the reveal screen. */
const SONGS = [
  {title:"Tujhe Dekha To", movie:"Dilwale Dulhania Le Jayenge", year:1995, era:"90s", mood:"romantic", diff:"easy", audio:""},
  {title:"Kuch Kuch Hota Hai", movie:"Kuch Kuch Hota Hai", year:1998, era:"90s", mood:"romantic", diff:"easy", audio:""},
  {title:"Chamma Chamma", movie:"China Gate", year:1998, era:"90s", mood:"party", diff:"hard", audio:""},
  {title:"Kal Ho Naa Ho", artists:["Sonu Nigam"], movie:"Kal Ho Naa Ho", year:2003, era:"2000s", mood:"sad", diff:"easy", audio:""},
  {title:"Kajra Re", movie:"Bunty Aur Babli", year:2005, era:"2000s", mood:"party", diff:"easy", audio:""},
  {title:"Jai Ho", movie:"Slumdog Millionaire", year:2008, era:"2000s", mood:"party", diff:"easy", audio:""},
  {title:"Tum Hi Ho", movie:"Aashiqui 2", year:2013, era:"2010s", mood:"romantic", diff:"easy", audio:""},
  {title:"Gerua", movie:"Dilwale", year:2015, era:"2010s", mood:"romantic", diff:"easy", audio:""},
  {title:"Kar Gayi Chull", movie:"Kapoor & Sons", year:2016, era:"2010s", mood:"party", diff:"hard", audio:""},
  {title:"Nashe Si Chadh Gayi", movie:"Befikre", year:2016, era:"2010s", mood:"party", diff:"hard", audio:""},
  {title:"Ghungroo", movie:"War", year:2019, era:"2010s", mood:"party", diff:"hard", audio:""},
  {title:"Kesariya", albumAliases:["Brahmastra Part One Shiva"], movie:"Brahmastra", year:2022, era:"2020s", mood:"romantic", diff:"easy", audio:""},
  {title:"Naatu Naatu", movie:"RRR", year:2022, era:"2020s", mood:"party", diff:"easy", audio:""},
  {title:"Pasoori", artists:["Ali Sethi", "Shae Gill"], albumAliases:["Pasoori", "Coke Studio Season 14"], movie:"Coke Studio", year:2022, era:"2020s", mood:"romantic", diff:"hard", audio:""},
  {title:"Chaleya", movie:"Jawan", year:2023, era:"2020s", mood:"romantic", diff:"easy", audio:""},
  {title:"Heeriye", artists:["Jasleen Royal", "Arijit Singh"], albumAliases:["Heeriye"], movie:"Single", year:2023, era:"2020s", mood:"romantic", diff:"hard", audio:""},
  {title:"Tauba Tauba", movie:"Bad Newz", year:2024, era:"2020s", mood:"party", diff:"hard", audio:""},
];

// Optional catalog fields: aliases, albumAliases, artists, duration (seconds).
// Match conservatively: metadata is evidence, not proof of the recording's identity.
function normalizeMusicText(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizeAlbumTitle(value) {
  // Album names may include soundtrack metadata; track titles must match in full.
  return normalizeMusicText(String(value || "")
    .replace(/\s*[([](?:from\s+|feat\.?\s+|featuring\s+)[^\])]*[\])]/gi, "")
    .replace(/\s*[([](?:original(?: motion picture)? soundtrack|original|album version|remastered(?: \d{4})?)[\])]/gi, "")
    .replace(/\s*[-–—]\s*(?:original(?: motion picture)? soundtrack|single|remastered(?: \d{4})?)$/i, ""));
}

const UNWANTED_ALBUM_VERSION = /\b(pocket cinema|karaoke|instrumental|cover|tribute|remix|re mix|mashup|medley|sped up|speed up|slowed|slow reverb|reverb|lo fi|lofi|live|unplugged|reprise|unwind)\b/;

function scoreDeezerTrack(track, song) {
  if (!track || typeof track.preview !== "string" || !track.preview.trim()) return null;
  // Never use title_short: it can hide arbitrary version labels in the full title.
  const titles = [song.title, ...(song.aliases || [])].map(normalizeMusicText).filter(Boolean);
  if (typeof track.title !== "string" || !titles.includes(normalizeMusicText(track.title))) return null;
  if (String(track.title_version || "").trim()) return null;
  // Keep the separate album safeguard for alternate recordings with plain titles.
  if (UNWANTED_ALBUM_VERSION.test(normalizeMusicText(track.album?.title))) return null;

  // Generic catalog labels such as "Single" aren't evidence of a matching album.
  const albums = [song.movie, ...(song.albumAliases || [])].filter(Boolean)
    .map(normalizeAlbumTitle).filter(title => title && title !== "single");
  const albumMatch = albums.includes(normalizeAlbumTitle(track.album?.title));
  const expectedArtists = (song.artists || []).map(normalizeMusicText);
  const actualArtists = [track.artist?.name, ...(track.contributors || []).map(artist => artist.name)]
    .filter(Boolean).map(normalizeMusicText);
  const artistMatch = expectedArtists.some(expected => actualArtists.some(actual =>
    (` ${actual} `).includes(` ${expected} `)));
  if (expectedArtists.length && actualArtists.length && !artistMatch) return null;
  if (!albumMatch && !artistMatch) return null;

  let score = 60 + (albumMatch ? 30 : 0) + (artistMatch ? 40 : 0);
  const duration = Number(track.duration);
  if (Number.isFinite(duration) && duration > 0) {
    if (song.duration) {
      if (Math.abs(duration - song.duration) > 20) return null;
      score += 10;
    } else if (duration < 60 || duration > 900) {
      // Suspicious lengths require manual catalog confirmation, not a global ban.
      score -= 50;
    }
  }
  return score >= 90 ? {track, score} : null;
}

function selectDeezerTrack(tracks, song) {
  if (!Array.isArray(tracks)) return null;
  const matches = tracks.map(track => scoreDeezerTrack(track, song)).filter(Boolean)
    .sort((a, b) => b.score - a.score);
  if (!matches.length) return null;
  const best = matches[0];
  // Equally strong but materially different recordings need review. Reissues of
  // the same performance can still match without relying on popularity or order.
  const ambiguous = matches.slice(1).some(candidate => candidate.score === best.score && (
    normalizeMusicText(candidate.track.artist?.name) !== normalizeMusicText(best.track.artist?.name) ||
    Math.abs(Number(candidate.track.duration) - Number(best.track.duration)) > 10
  ));
  return ambiguous ? null : best.track;
}

const CLIPS = [0.5, 2, 5, 8, 15];
const CORS_PROXY = "https://corsproxy.io/?key=905595b0&url=";
const $ = id => document.getElementById(id);
const audio = $("audio");
let pool=[], current=null, stage=0, solved=false, streak=0, total=0;
let ready=false, loadVersion=0, playVersion=0, clipTimer, requestController, cancelAudioLoad;

function updateActionButton(){
  $("skipBtn").textContent = $("guess").value.trim() ? "Guess" : (stage === CLIPS.length - 1 ? "Give up" : "Skip");
}

function buildStages(){
  updateActionButton();
  $("stages").innerHTML = CLIPS.map((c,i)=>
    `<div class="stage ${i===stage?'active':''} ${i<stage?'done':''}">${c}s</div>`).join("");
}

function filterPool(){
  const e=$("era").value, m=$("mood").value, d=$("diff").value;
  pool = SONGS.filter(s=>
    (e==="any" || s.era===e) && (m==="any" || s.mood===m) && (d==="any" || s.diff===d));
  if(!pool.length) pool = SONGS.slice();
}

async function fetchDeezerPreview(song, signal) {
  if (song.audio) return song.audio;
  const query = encodeURIComponent(`${song.title} ${song.movie === "Single" ? (song.artists?.[0] || "") : song.movie}`);
  const resp = await fetch(`${CORS_PROXY}${encodeURIComponent(`https://api.deezer.com/search?q=${query}&limit=50`)}`, {signal});
  if (!resp.ok) throw new Error("Song search failed");
  const data = await resp.json();
  if (data.error) throw new Error("Song search failed");
  const track = selectDeezerTrack(data.data, song);
  if (!track) {
    const error = new Error("No confident recording match");
    error.code = "NO_MATCH";
    throw error;
  }
  song.deezerId = track.id;
  song.audio = track.preview;
  song.cover = track.album?.cover_big || track.album?.cover_medium || track.album?.cover || "";
  return song.audio;
}

function stopClip(){
  playVersion++;
  clearTimeout(clipTimer);
  audio.pause();
  $("playBtn").textContent = "▶";
}

function loadAudio(url){
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("error", onError);
      cancelAudioLoad = null;
    };
    const onReady = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("Preview could not load")); };
    const timeout = setTimeout(onError, 15000);
    cancelAudioLoad = onError;
    audio.addEventListener("canplay", onReady);
    audio.addEventListener("error", onError);
    audio.src = url;
    audio.load();
  });
}

async function newSong(){
  const version = ++loadVersion;
  requestController?.abort();
  cancelAudioLoad?.();
  stopClip();
  ready=false;
  filterPool();
  const candidates = pool.filter(song => song !== current);
  current = (candidates.length ? candidates : pool)[Math.floor(Math.random() * (candidates.length || pool.length))];
  const song = current;
  stage=0; solved=false;
  buildStages();
  $("celebration").hidden=true;
  $("confetti").replaceChildren();
  $("roundContent").inert=false;
  $("result").textContent="";
  $("roundScore").textContent="—";
  $("guess").value="";
  updateActionButton();
  $("suggest").style.display="none";
  $("guess").disabled=true;
  $("skipBtn").disabled=true;
  $("playBtn").disabled=true;
  $("retryBtn").hidden=true;
  $("clipLabel").textContent="Loading your song…";
  requestController = new AbortController();
  const controller = requestController;
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const audioUrl = await fetchDeezerPreview(song, controller.signal);
    if (version !== loadVersion) return;
    clearTimeout(timeout);
    await loadAudio(audioUrl);
    if (version !== loadVersion) return;
    ready=true;
    $("clipLabel").textContent=`Stage 1: ${CLIPS[0]}s clip — press play!`;
    $("playBtn").disabled=false;
    $("guess").disabled=false;
    $("skipBtn").disabled=false;
  } catch (err) {
    if (version !== loadVersion) return;
    song.audio="";
    $("clipLabel").textContent = err.code === "NO_MATCH"
      ? "Couldn't find a reliable recording. Retry to try another song."
      : "Couldn't load the song. Please retry.";
    $("retryBtn").hidden=false;
  } finally {
    clearTimeout(timeout);
  }
}

async function playClip() {
  if (!ready || solved) return;
  stopClip();
  const version = playVersion;
  const duration = CLIPS[stage];
  audio.currentTime = 0;
  try {
    await audio.play();
    if (version !== playVersion) return;
    $("playBtn").textContent = "🔊";
    $("clipLabel").textContent = `Playing ${duration}s...`;
    clipTimer = setTimeout(() => {
      stopClip();
      $("clipLabel").textContent = `Stage ${stage + 1}: ${duration}s clip`;
    }, duration * 1000);
  } catch (err) {
    if (version !== playVersion) return;
    $("clipLabel").textContent = "Playback failed. Press play to retry.";
  }
}

function revealSong(won, points){
  solved=true;
  stopClip();
  $("suggest").style.display="none";
  $("guess").disabled=true;
  $("skipBtn").disabled=true;
  $("playBtn").disabled=true;
  $("roundContent").inert=true;
  $("celebrationHeading").textContent=won ? "You got it! 🎉" : "Meet the song! ✨";
  $("songTitle").textContent=current.title;
  $("songDetails").textContent=`${current.movie} · ${current.year}`;
  $("roundMessage").textContent=won ? `+${points} points · Keep the streak going!` : "A new favorite? Try another round!";
  const cover = $("songCover");
  cover.hidden=true;
  $("coverFallback").hidden=false;
  cover.onload=() => { cover.hidden=false; $("coverFallback").hidden=true; };
  cover.onerror=() => { cover.hidden=true; $("coverFallback").hidden=false; };
  cover.alt=`Album cover for ${current.title}`;
  if (current.cover) cover.src=current.cover;
  else cover.removeAttribute("src");
  $("confetti").replaceChildren();
  const colors=["#ff5a8a", "#ffb347", "#3ddc84", "#b79aff", "#f3eefc"];
  for(let i=0;i<45;i++){
    const piece=document.createElement("i");
    piece.style.cssText=`--x:${Math.random()*100}%;--y:${Math.random()*100}%;--color:${colors[i%colors.length]};--duration:${3+Math.random()*3}s;--delay:${-Math.random()*6}s`;
    $("confetti").append(piece);
  }
  $("celebration").hidden=false;
  $("againBtn").focus();
}

function showSuggestions(query){
  const box = $("suggest");
  if(!query.trim()){ box.style.display="none"; return; }
  const q = query.toLowerCase();
  const matches = SONGS.filter(s => 
    s.title.toLowerCase().includes(q) || s.movie.toLowerCase().includes(q)
  ).slice(0, 8);
  if(!matches.length){ box.style.display="none"; return; }
  box.innerHTML = matches.map(s =>
    `<div data-title="${s.title}"><b>${s.title}</b><br><small>${s.movie} (${s.year})</small></div>`
  ).join("");
  box.style.display = "block";
}

function selectSong(title){
  $("guess").value = title;
  $("suggest").style.display = "none";
  updateActionButton();
  $("skipBtn").focus();
}

function submitGuess(title){
  if(!ready || solved) return;
  $("suggest").style.display = "none";
  const guess = title.toLowerCase().trim();
  const answer = current.title.toLowerCase().trim();
  if(!guess) return;
  if(guess === answer || guess.includes(answer) || answer.includes(guess)){
    const points = Math.max(100 - stage * 20, 20);
    streak++;
    total += points;
    $("roundScore").textContent = points;
    $("streak").textContent = streak;
    $("total").textContent = total;
    revealSong(true, points);
  } else {
    $("result").textContent = "❌ Not quite… try again!";
  }
}

function skip(){
  if(!ready || solved) return;
  stopClip();
  if(stage < CLIPS.length - 1){
    stage++;
    buildStages();
    $("clipLabel").textContent = `Stage ${stage+1}: ${CLIPS[stage]}s clip`;
    $("result").textContent = `Now ${CLIPS[stage]}s of the song is available.`;
  } else {
    giveUp();
  }
}

function giveUp(){
  if(!ready || solved || stage !== CLIPS.length - 1) return;
  streak = 0;
  $("roundScore").textContent = "0";
  $("streak").textContent = streak;
  revealSong(false, 0);
}

// Event Listeners
$("againBtn").addEventListener("click", newSong);
$("retryBtn").addEventListener("click", newSong);
["era", "mood", "diff"].forEach(id => $(id).addEventListener("change", newSong));
$("playBtn").addEventListener("click", playClip);
$("skipBtn").addEventListener("click", ()=>{
  if($("guess").value.trim()) submitGuess($("guess").value);
  else skip();
});

$("guess").addEventListener("input", (e)=>{
  updateActionButton();
  showSuggestions(e.target.value);
});

$("guess").addEventListener("keydown", (e)=>{
  if(e.key === "Enter"){
    $("suggest").style.display = "none";
    submitGuess($("guess").value);
  }
});

$("suggest").addEventListener("click", (e)=>{
  const div = e.target.closest("div[data-title]");
  if(div) selectSong(div.dataset.title);
});

// Close suggestions when clicking outside
document.addEventListener("click", (e)=>{
  if(!e.target.closest(".search")){
    $("suggest").style.display = "none";
  }
});

// Fetch and preload the first song without autoplaying.
newSong();
