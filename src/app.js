const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = "jacob_neon_save_v1";

function toast(msg){
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"), 1400);
}

async function loadJSON(path){
  const res = await fetch(path);
  if(!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

function defaultState(){
  return {
    idx: 0,
    classKey: null,
    gift: null,
    nightActionsLeft: 2,
    bonds: {},
    party: ["apex","dedor","jeffery","felix"],
    flags: {},
    _passedScenes: {}
  };
}

function saveState(st){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
  $("#saveHint").textContent = "Saved";
  setTimeout(()=>$("#saveHint").textContent="", 800);
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    return null;
  }
}

function resetState(){ localStorage.removeItem(STORAGE_KEY); }

function escapeHtml(str){
  return (str ?? "").replace(/[&<>'"]/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  }[c]));
}
function pillList(items){
  return (items || []).map(x => `<span class="pill">${escapeHtml(x)}</span>`).join("");
}
function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

function computeTier(npc, interactions){
  let tier = 0;
  for(const t of npc.tiers || []){
    if(interactions >= t.unlock) tier = t.tier;
  }
  return tier;
}

function ensurePartyAvailability(state, npcs){
  for(const npc of npcs){
    if(!npc.availabilityRules) continue;
    for(const rule of npc.availabilityRules){
      if(rule.when === "after_scene"){
        if(state._passedScenes?.[rule.sceneKey] && !state.party.includes(npc.key)){
          state.party.push(npc.key);
          toast(`${npc.name} joins the party.`);
        }
      }
    }
  }
}

function markScenePassed(state, sceneKey){
  state._passedScenes = state._passedScenes || {};
  state._passedScenes[sceneKey] = true;
}

function exportSave(state){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "jacob_neon_save.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importSave(){
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".json,application/json";
  inp.onchange = () => {
    const file = inp.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const st = JSON.parse(reader.result);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
        location.reload();
      }catch(e){
        toast("Invalid save file.");
      }
    };
    reader.readAsText(file);
  };
  inp.click();
}

function buildClassEmphasisTable(classes){
  const rows = classes.map(c => `
    <tr>
      <td><b>${escapeHtml(c.name)}</b><div class="small">${escapeHtml(c.tagline)}</div></td>
      <td>${pillList(c.sceneEmphasis)}</td>
    </tr>
  `).join("");
  return `
    <div class="small">Class → Scene Emphasis</div>
    <table class="table" style="margin-top:8px;">
      <thead><tr><th style="width:34%;">Class</th><th>Scene Emphasis</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildNpcAffinityMatrix(classes, npcs){
  const head = `<tr><th>NPC</th>${classes.map(c=>`<th>${escapeHtml(c.name)}</th>`).join("")}</tr>`;
  const body = npcs.map(n=>{
    const row = classes.map(c=>{
      const v = (n.affinity && n.affinity[c.key]) ?? 0;
      return `<td>${v === 0 ? "—" : String(v)}</td>`;
    }).join("");
    return `<tr><td><b>${escapeHtml(n.name)}</b><div class="small">${escapeHtml(n.role)}</div></td>${row}</tr>`;
  }).join("");
  return `
    <div class="small" style="margin-top:14px;">NPC → Class Affinity (0–4)</div>
    <table class="table" style="margin-top:8px;">
      <thead>${head}</thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function setHeaderBadges(state, panel, sceneTitle){
  $("#badgeClass").textContent = `Class: ${state.classKey ?? "—"}`;
  $("#badgeScene").textContent = `Scene: ${sceneTitle ?? "—"}`;
  $("#panelHeader").textContent = panel.title ? panel.title : (panel.kind || "Panel").toUpperCase();
  $("#panelMeta").textContent = `#${state.idx+1}`;
}

function renderStateSidebar(state, npcsByKey){
  $("#stGift").textContent = state.gift ?? "—";
  $("#stParty").textContent = state.party.map(k=>npcsByKey[k]?.name ?? k).join(", ");
  $("#stActions").textContent = String(state.nightActionsLeft);
  const bonds = Object.entries(state.bonds || {}).map(([k,v])=>`${npcsByKey[k]?.name ?? k}:${v}`).join(" • ");
  $("#stBonds").textContent = bonds || "—";
}

function renderPanel(panel, ctx){
  const {state, classes, npcs, npcsByKey, scenesByKey} = ctx;
  const container = $("#panelBody");
  container.innerHTML = "";

  $("#panelImg").src = panel.image || "assets/panels/placeholder_choice.svg";
  $("#panelImg").alt = panel.title || panel.scene || "panel art";

  const sceneTitle = scenesByKey[panel.scene]?.title ?? panel.scene;
  setHeaderBadges(state, panel, sceneTitle);
  renderStateSidebar(state, npcsByKey);

  if(panel.scene) markScenePassed(state, panel.scene);
  ensurePartyAvailability(state, npcs);

  if(["narration","arc","ending"].includes(panel.kind)){
    container.innerHTML = `
      ${panel.title ? `<div class="panel-title">${escapeHtml(panel.title)}</div>` : ""}
      <div class="linebox">${escapeHtml(panel.text)}</div>
      <div class="small" style="margin-top:10px;">Press <b>Next</b> to continue.</div>
    `;
    return;
  }

  if(panel.kind === "dialogue"){
    container.innerHTML = `
      <div class="panel-title"><span class="speaker">${escapeHtml(panel.speaker ?? "Unknown")}</span></div>
      <div class="linebox">${escapeHtml(panel.text)}</div>
      <div class="small" style="margin-top:10px;">Press <b>Next</b> to continue.</div>
    `;
    return;
  }

  if(panel.kind === "choice"){
    const choices = panel.choices || [];
    container.innerHTML = `
      <div class="panel-title">${escapeHtml(panel.prompt ?? "Choose")}</div>
      <div class="choice-list">
        ${choices.map((c,i)=>`<button class="choice" data-choice="${i}">${escapeHtml(c.label)}</button>`).join("")}
      </div>
      <div class="small" style="margin-top:10px;">Choices can set flags, items, relationships, etc.</div>
    `;
    container.querySelectorAll("[data-choice]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const i = Number(btn.getAttribute("data-choice"));
        const pick = choices[i];
        if(pick?.effects){
          for(const [k,v] of Object.entries(pick.effects)){
            if(k === "gift") state.gift = v;
            else state.flags[k] = v;
          }
        }
        toast("Choice locked.");
        saveState(state);
        next(ctx);
      });
    });
    return;
  }

  if(panel.kind === "class_select"){
    container.innerHTML = `
      <div class="panel-title">${escapeHtml(panel.prompt ?? "Choose your class")}</div>
      <div class="choice-list">
        ${classes.map((c)=>`
          <button class="choice" data-class="${escapeHtml(c.key)}">
            <b>${escapeHtml(c.name)}</b>
            <div class="small">${escapeHtml(c.tagline)}</div>
            <div style="margin-top:6px;">${pillList(c.sceneEmphasis)}</div>
          </button>
        `).join("")}
      </div>
      <div class="small" style="margin-top:10px;">Your class affects NPC affinity and optional scene flavor.</div>
    `;
    container.querySelectorAll("[data-class]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        state.classKey = btn.getAttribute("data-class");
        toast(`Class locked: ${state.classKey}`);
        saveState(state);
        next(ctx);
      });
    });
    return;
  }

  if(panel.kind === "camp"){
    const available = state.party.map(k=>npcsByKey[k]).filter(Boolean);

    const renderTierText = (n, interactions) => {
      const tier = computeTier(n, interactions);
      if(tier <= 0) return `<div class="small">No bond tier unlocked yet.</div>`;
      const t = (n.tiers || []).find(x=>x.tier === tier);
      return `
        <div><b>${escapeHtml(t?.title ?? "Bond Moment")}</b></div>
        <div class="small">${escapeHtml(t?.notes ?? "")}</div>
      `;
    };

    const npcCard = (n) => {
      const interactions = state.bonds[n.key] ?? 0;
      const tier = computeTier(n, interactions);
      const nextTier = (n.tiers || []).find(t => t.unlock > interactions);
      const classAff = (state.classKey && n.affinity) ? (n.affinity[state.classKey] ?? 0) : 0;

      return `
        <div class="linebox" style="margin-top:10px;">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
            <div>
              <div><b>${escapeHtml(n.name)}</b> <span class="pill">${escapeHtml(n.role)}</span></div>
              <div class="small">${escapeHtml(n.blurb)}</div>
              <div class="small" style="margin-top:6px;">
                Bond: <b>${interactions}</b> • Tier: <b>${tier}</b> • Class Affinity: <b>${classAff}</b>/4
              </div>
            </div>
            <button class="btn primary" data-talk="${escapeHtml(n.key)}" ${state.nightActionsLeft<=0 ? "disabled":""}>Talk</button>
          </div>
          <div class="hr"></div>
          ${renderTierText(n, interactions)}
          <div class="small" style="margin-top:8px;">
            ${nextTier ? `Next unlock at <b>${nextTier.unlock}</b>: ${escapeHtml(nextTier.title)}` : `All tiers unlocked.`}
          </div>
        </div>
      `;
    };

    container.innerHTML = `
      <div class="panel-title">${escapeHtml(panel.prompt ?? "Camp")}</div>
      <div class="small">You have <b>${state.nightActionsLeft}</b> action(s) tonight.</div>
      ${available.map(npcCard).join("")}
      <div class="hr"></div>
      <div class="small">When you’re done, press <b>Next</b> to move on.</div>
    `;

    container.querySelectorAll("[data-talk]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        if(state.nightActionsLeft <= 0) return;
        const k = btn.getAttribute("data-talk");
        state.bonds[k] = (state.bonds[k] ?? 0) + 1;

        const npc = npcsByKey[k];
        const aff = (state.classKey && npc?.affinity) ? (npc.affinity[state.classKey] ?? 0) : 0;
        if(aff >= 4 && Math.random() < 0.33){
          state.bonds[k] += 1;
          toast(`${npc.name} vibes with your craft (+1 bond).`);
        }else{
          toast(`You talk with ${npc.name}.`);
        }

        state.nightActionsLeft = clamp(state.nightActionsLeft - 1, 0, 99);
        saveState(state);
        renderPanel(panel, ctx);
      });
    });

    return;
  }

  container.innerHTML = `<div class="linebox">Unknown panel kind: ${escapeHtml(panel.kind)}</div>`;
}

function next(ctx){
  const {state, panels} = ctx;
  const cur = panels[state.idx];

  if(cur?.kind === "class_select" && !state.classKey){
    toast("Pick a class first.");
    return;
  }

  const nxt = panels[state.idx + 1];
  if(nxt?.kind === "camp"){
    state.nightActionsLeft = 2;
  }

  state.idx = Math.min(state.idx + 1, panels.length - 1);
  saveState(state);
  renderPanel(panels[state.idx], ctx);
}

function restart(){
  resetState();
  location.reload();
}

async function main(){
  const [classes, npcs, scenes, panels] = await Promise.all([
    loadJSON("data/classes.json"),
    loadJSON("data/npcs.json"),
    loadJSON("data/scenes.json"),
    loadJSON("data/panels.json"),
  ]);

  const scenesByKey = Object.fromEntries(scenes.map(s=>[s.key,s]));
  const npcsByKey = Object.fromEntries(npcs.map(n=>[n.key,n]));

  let state = loadState() || defaultState();
  state.flags = state.flags || {};
  state.bonds = state.bonds || {};
  state.party = state.party || ["apex","dedor","jeffery","felix"];
  state.nightActionsLeft = Number.isFinite(state.nightActionsLeft) ? state.nightActionsLeft : 2;
  state.idx = Number.isFinite(state.idx) ? state.idx : 0;
  state._passedScenes = state._passedScenes || {};

  const ctx = {state, classes, npcs, scenes, panels, scenesByKey, npcsByKey};

  $("#btnSkip").addEventListener("click", ()=> next(ctx));
  $("#btnRestart").addEventListener("click", restart);
  $("#btnExport").addEventListener("click", ()=> exportSave(state));
  $("#btnImport").addEventListener("click", importSave);

  const dlg = $("#dlgTables");
  $("#btnTables").addEventListener("click", ()=>{
    $("#tablesBody").innerHTML = buildClassEmphasisTable(classes) + buildNpcAffinityMatrix(classes, npcs);
    dlg.showModal();
  });
  $("#btnCloseTables").addEventListener("click", ()=> dlg.close());

  saveState(state);
  renderPanel(panels[state.idx], ctx);
}

main().catch(e=>{
  console.error(e);
  document.body.innerHTML = `<pre style="color:#fff; padding:18px;">Boot error: ${String(e)}</pre>`;
});
