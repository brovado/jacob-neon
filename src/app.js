const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = "jacob_neon_save_v2";

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
    seenNodes: {},
    unlockedNodes: { npc: {}, global: [] },
    lastTalk: {},
    act: 0,
    party: ["apex","dedor","theramous","widjet","jeffery","pilgrim_1","pilgrim_2","pilgrim_3"],
    flags: {},
    stats: { supplies: 20, morale: 10, suspicion: 0, wounds: 0 },
    dead: [],
    _passedScenes: {}
  };
}

function saveState(st){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
  const hint = $("#saveHint");
  if(!hint) return;
  hint.textContent = "Saved";
  setTimeout(()=>{
    const current = $("#saveHint");
    if(current) current.textContent = "";
  }, 800);
}

function loadState(){
  try{ const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
function resetState(){ localStorage.removeItem(STORAGE_KEY); }

function escapeHtml(str){
  return (str ?? "").replace(/[&<>'"]/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  }[c]));
}
function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

function getVariant(baseText, variants, classKey){
  if(!variants || !classKey) return baseText;
  return variants[classKey] ?? baseText;
}

function applyDelta(obj, delta){
  if(!delta) return;
  for(const [k,v] of Object.entries(delta)){
    obj[k] = (obj[k] ?? 0) + Number(v);
  }
}

function applyEffects(state, effects){
  if(!effects) return;

  if(effects.gift) state.gift = effects.gift;
  if(effects.classKey) state.classKey = effects.classKey;

  if(effects.flags){
    for(const [k,v] of Object.entries(effects.flags)){
      state.flags[k] = v;
    }
  }

  const statDelta = effects.stats || effects.statsDelta || effects.stats_delta;
  if(statDelta){
    applyDelta(state.stats, statDelta);
    state.stats.supplies = clamp(state.stats.supplies, 0, 99);
    state.stats.morale = clamp(state.stats.morale, -20, 20);
    state.stats.suspicion = clamp(state.stats.suspicion, 0, 99);
    state.stats.wounds = clamp(state.stats.wounds, 0, 99);
  }

  if(effects.party){
    const add = effects.party.add || [];
    const rem = effects.party.remove || [];
    for(const k of add){
      if(!state.party.includes(k) && !state.dead.includes(k)) state.party.push(k);
    }
    for(const k of rem){
      state.party = state.party.filter(x=>x!==k);
    }
  }

  const bondDelta = effects.bond || effects.bonds;
  if(bondDelta){
    for(const [npcKey,delta] of Object.entries(bondDelta)){
      state.bonds[npcKey] = (state.bonds[npcKey] ?? 0) + Number(delta);
    }
  }

  if(effects.unlock){
    const npcNodes = effects.unlock.npcNodes || [];
    const globalNodes = effects.unlock.globalNodes || [];
    state.unlockedNodes = state.unlockedNodes || { npc: {}, global: [] };
    for(const node of npcNodes){
      if(!node?.npcKey || !node?.nodeKey) continue;
      if(!state.unlockedNodes.npc[node.npcKey]) state.unlockedNodes.npc[node.npcKey] = [];
      if(!state.unlockedNodes.npc[node.npcKey].includes(node.nodeKey)){
        state.unlockedNodes.npc[node.npcKey].push(node.nodeKey);
      }
    }
    for(const nodeKey of globalNodes){
      if(!nodeKey) continue;
      if(!state.unlockedNodes.global.includes(nodeKey)){
        state.unlockedNodes.global.push(nodeKey);
      }
    }
  }
}

function exportSave(state){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "jacob_neon_save_v2.json";
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

function npcByKey(npcs, key){ return npcs.find(n=>n.key===key) || null; }

function computeTier(npc, interactions){
  let tier = 0;
  for(const t of npc?.tiers || []) if(interactions >= t.unlock) tier = t.tier;
  return tier;
}

function getActInfo(panel, state){
  const rawAct = panel?.act;
  if(typeof rawAct === "number"){
    const label = rawAct === 1.5 ? "Interlude" : rawAct >= 3 ? "Ending" : `Act ${rawAct}`;
    return { value: rawAct, label };
  }
  if(typeof rawAct === "string"){
    const lower = rawAct.toLowerCase();
    if(lower.includes("interlude")) return { value: 1.5, label: "Interlude" };
    const num = Number(lower.replace(/[^\d.]/g, ""));
    if(Number.isFinite(num)) return { value: num, label: num >= 3 ? "Ending" : `Act ${num}` };
  }
  const scene = panel?.scene || "";
  if(scene.startsWith("act0") || scene.startsWith("intro")) return { value: 0, label: "Act 0" };
  if(scene.startsWith("act1")) return { value: 1, label: "Act 1" };
  if(scene.startsWith("interlude")) return { value: 1.5, label: "Interlude" };
  if(scene.startsWith("act2")) return { value: 2, label: "Act 2" };
  if(scene.startsWith("end")) return { value: 3, label: "Ending" };
  if(scene.startsWith("camp")) return { value: state?.act ?? 0, label: `Act ${state?.act ?? 0}` };
  return { value: state?.act ?? 0, label: `Act ${state?.act ?? 0}` };
}

function getClassData(classesByKey, classKey){
  if(!classesByKey || !classKey) return null;
  return classesByKey[classKey] || null;
}

function applySceneEmphasisBonus(state, panel, classesByKey){
  if(!state.classKey || !panel?.emphasis) return false;
  const classData = getClassData(classesByKey, state.classKey);
  if(!classData) return false;
  const emphasisList = Array.isArray(panel.emphasis) ? panel.emphasis : [panel.emphasis];
  let applied = false;
  for(const emphasis of emphasisList){
    const weight = classData.sceneWeights?.[emphasis] ?? 0;
    if(weight < 3) continue;
    switch(emphasis){
      case "travel":
        state.stats.supplies = clamp(state.stats.supplies + 1, 0, 99);
        applied = true;
        break;
      case "intrigue":
        state.stats.suspicion = clamp(state.stats.suspicion - 1, 0, 99);
        applied = true;
        break;
      case "craft":
        state.stats.morale = clamp(state.stats.morale + 1, -20, 20);
        applied = true;
        break;
      case "defense":
        state.stats.wounds = clamp(state.stats.wounds - 1, 0, 99);
        applied = true;
        break;
      case "negotiation":
        state.stats.supplies = clamp(state.stats.supplies + 1, 0, 99);
        applied = true;
        break;
      case "ritual":
        state.stats.morale = clamp(state.stats.morale + 1, -20, 20);
        applied = true;
        break;
      case "camp":
        state.stats.morale = clamp(state.stats.morale + 1, -20, 20);
        applied = true;
        break;
      default:
        break;
    }
  }
  return applied;
}

function pickNpcNode(npc, state){
  const nodes = npc?.nodes || [];
  const seen = state.seenNodes?.[npc.key] || [];
  const unlockedNpc = state.unlockedNodes?.npc?.[npc.key] || [];
  const unlockedGlobal = state.unlockedNodes?.global || [];
  const bond = state.bonds[npc.key] ?? 0;
  const available = nodes.filter(node => {
    if(!node) return false;
    if(node.once !== false && seen.includes(node.key)) return false;
    const tierMin = node.tierMin ?? 0;
    const actMin = node.actMin ?? 0;
    const requires = node.requiresFlags || [];
    const flagsOk = requires.every(flag => state.flags?.[flag]);
    const unlocked = unlockedNpc.includes(node.key) || unlockedGlobal.includes(node.key);
    const meets = bond >= tierMin && state.act >= actMin && flagsOk;
    return unlocked || meets;
  });
  available.sort((a,b)=>{
    const tierDiff = (b.tierMin ?? 0) - (a.tierMin ?? 0);
    if(tierDiff !== 0) return tierDiff;
    return (b.actMin ?? 0) - (a.actMin ?? 0);
  });
  return available[0] || null;
}

function getNpcAffinityBonus(npc, classKey){
  if(!npc?.affinity || !classKey) return 0;
  const affinity = Number(npc.affinity[classKey] ?? 0);
  if(affinity >= 4) return 1;
  return 0;
}

// Class perk: small automatic modifiers (simple + visible)
function applyClassPassive(state, panel){
  const c = state.classKey;
  if(!c) return;

  // examples (you can expand these)
  if(panel?.scene === "road-02_harpies"){
    if(c === "cartographer") state.stats.wounds = Math.max(0, state.stats.wounds - 1);
    if(c === "smith") state.stats.morale = clamp(state.stats.morale + 1, -20, 20);
  }
}

// Death system hook: always ensures one guide dies unless you pay a cost.
// You can later expand to more nuanced logic or multiple deaths.
function resolveDeathEvent(state, panel){
  const guideKeys = panel?.death?.guides || ["guide_1","guide_2","guide_3"];
  const guides = guideKeys.filter(k => state.party.includes(k) && !state.dead.includes(k));
  if(guides.length === 0){
    toast("No guides present for the death event.");
    return null;
  }

  let minSupplies = panel?.death?.minSupplies ?? 10;
  let minMorale = panel?.death?.minMorale ?? 5;
  let costSupplies = panel?.death?.costSupplies ?? 10;
  let perkNote = null;

  if(state.flags?.ambush_barricade) minSupplies = Math.max(6, minSupplies - 2);
  if(state.flags?.ambush_scatter) minMorale += 1;
  if(state.flags?.ambush_lure) costSupplies = Math.max(5, costSupplies - 2);

  if(state.classKey === "architect"){
    costSupplies = Math.max(0, costSupplies - 2);
    perkNote = "Class perk: your fortifications reduce the cost to save everyone.";
  }
  if(state.classKey === "relicator" && state.stats.wounds <= 2){
    minSupplies = Math.max(0, minSupplies - 4);
    perkNote = "Class perk: warding tricks lower the supply threshold.";
  }

  if(state.stats.supplies >= minSupplies && state.stats.morale >= minMorale){
    return { canSaveAll: true, costSupplies, options: guides, perkNote, minSupplies, minMorale };
  }

  // Otherwise: someone will die; survival odds depend on wounds/suspicion.
  return { canSaveAll: false, costSupplies: 0, options: guides, perkNote, minSupplies, minMorale };
}

function renderStateSidebar(state, npcs){
  $("#stGift").textContent = state.gift ?? "—";
  $("#stClass").textContent = state.classKey ?? "—";
  $("#stActions").textContent = String(state.nightActionsLeft);

  const livingParty = state.party.filter(k => !state.dead.includes(k));
  $("#stParty").innerHTML = livingParty.length
    ? livingParty.map(k => `<span class="pill">${escapeHtml(npcByKey(npcs,k)?.name ?? k)}</span>`).join("")
    : "<span class=\"small\">—</span>";

  const bondEntries = Object.entries(state.bonds).filter(([,v]) => Number(v) > 0);
  $("#stBonds").innerHTML = bondEntries.length
    ? bondEntries.map(([k,v]) => `<div><b>${escapeHtml(npcByKey(npcs,k)?.name ?? k)}</b> • ${escapeHtml(String(v))}</div>`).join("")
    : "<span class=\"small\">—</span>";

  $("#stSup").textContent = String(state.stats.supplies);
  $("#stMor").textContent = String(state.stats.morale);
  $("#stSus").textContent = String(state.stats.suspicion);
  $("#stWou").textContent = String(state.stats.wounds);
}

function setHeaderBadges(state, panel, sceneTitle){
  $("#badgeClass").textContent = `Class: ${state.classKey ?? "—"}`;
  const actInfo = getActInfo(panel, state);
  $("#badgeScene").textContent = `${actInfo.label} • ${sceneTitle ?? "—"}`;
  const headerTitle = getVariant(panel.title, panel.title_variants, state.classKey);
  $("#panelHeader").textContent = headerTitle ? headerTitle : (panel.kind || "Panel").toUpperCase();
  $("#panelMeta").textContent = `#${state.idx+1}`;
}

function renderPanel(panel, ctx){
  const {state, classes, npcs, scenesByKey, panels, classesByKey} = ctx;

  if(!panel){
    const container = $("#panelBody");
    if(container){
      container.innerHTML = `<div class="linebox">No panel found. Check data/panels.json.</div>`;
    }
    return;
  }

  // passive class effects (kept light)
  applyClassPassive(state, panel);

  const actInfo = getActInfo(panel, state);
  state.act = actInfo.value;

  const container = $("#panelBody");
  if(container) container.innerHTML = "";
  const panelImg = $("#panelImg");
  if(panelImg) panelImg.src = panel.image || "assets/panels/placeholder_choice.svg";

  const sceneTitle = scenesByKey[panel.scene]?.title ?? panel.scene;
  setHeaderBadges(state, panel, sceneTitle);
  renderStateSidebar(state, npcs);
  saveState(state);

  // Gate: class must be selected
  if(panel.kind === "class_select"){
    const note = panel.note ? `<div class="small" style="margin-top:10px;">${escapeHtml(panel.note)}</div>` : "";
    const prompt = getVariant(panel.prompt ?? "Choose your class", panel.prompt_variants, state.classKey);
    container.innerHTML = `
      <div class="panel-title">${escapeHtml(prompt)}</div>
      <div class="choice-list">
        ${classes.map((c)=>`
          <button class="choice" data-class="${escapeHtml(c.key)}">
            <b>${escapeHtml(c.name)}</b>
            <div class="small">${escapeHtml(c.tagline)}</div>
            ${c.perks?.length ? `<div class="choice-desc">${escapeHtml(c.perks.map(p => p.label).join(" • "))}</div>` : ""}
          </button>
        `).join("")}
      </div>
      ${note || `<div class="small" style="margin-top:10px;">Class perks influence stats & outcomes.</div>`}
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

  if(panel.kind === "narration" || panel.kind === "ending"){
    const title = getVariant(panel.title, panel.title_variants, state.classKey);
    const text = getVariant(panel.text, panel.text_variants, state.classKey);
    container.innerHTML = `
      ${title ? `<div class="panel-title">${escapeHtml(title)}</div>` : ""}
      <div class="linebox">${escapeHtml(text)}</div>
      <div class="small" style="margin-top:10px;">Press <b>Next</b> to continue.</div>
    `;
    return;
  }

  if(panel.kind === "dialogue"){
    const text = getVariant(panel.text, panel.text_variants, state.classKey);
    container.innerHTML = `
      <div class="panel-title"><span class="speaker">${escapeHtml(panel.speaker ?? "Unknown")}</span></div>
      <div class="linebox">${escapeHtml(text)}</div>
      <div class="small" style="margin-top:10px;">Press <b>Next</b> to continue.</div>
    `;
    return;
  }

  if(panel.kind === "choice"){
    const choices = panel.choices || [];
    const text = getVariant(panel.text, panel.text_variants, state.classKey);
    const intro = text ? `<div class="linebox">${escapeHtml(text)}</div>` : "";
    const prompt = getVariant(panel.prompt ?? "Choose", panel.prompt_variants, state.classKey);
    const note = panel.note ? `<div class="small" style="margin-top:10px;">${escapeHtml(panel.note)}</div>` : "";
    container.innerHTML = `
      <div class="panel-title">${escapeHtml(prompt)}</div>
      ${intro}
      <div class="choice-list">
        ${choices.map((c,i)=>`
          <button class="choice" data-choice="${i}">
            ${escapeHtml(getVariant(c.label, c.label_variants, state.classKey))}
            ${c.desc ? `<div class="choice-desc">${escapeHtml(c.desc)}</div>` : ""}
          </button>
        `).join("")}
      </div>
      ${note || `<div class="small" style="margin-top:10px;">Your stats carry forward.</div>`}
    `;
    container.querySelectorAll("[data-choice]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const i = Number(btn.getAttribute("data-choice"));
        const pick = choices[i];
        applyEffects(state, pick?.effects);
        const bonusApplied = applySceneEmphasisBonus(state, panel, classesByKey);
        if(bonusApplied) toast("Class perk triggered.");
        toast("Choice locked.");
        saveState(state);
        next(ctx);
      });
    });
    return;
  }

  if(panel.kind === "camp"){
    const party = state.party.filter(k => !state.dead.includes(k));
    const available = party.map(k=>npcByKey(npcs,k)).filter(Boolean);

    const npcCard = (n) => {
      const interactions = state.bonds[n.key] ?? 0;
      const tier = computeTier(n, interactions);
      const nextTier = (n.tiers || []).find(t => t.unlock > interactions);
      const lastNode = state.lastTalk?.[n.key];
      const lastNodeText = lastNode?.text ? `<div class="small" style="margin-top:8px;">${escapeHtml(lastNode.text)}</div>` : "";
      const lastNodeHeader = lastNode?.kind ? `<div><b>${escapeHtml(lastNode.kind)}</b></div>` : "";
      return `
        <div class="linebox" style="margin-top:10px;">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
            <div>
              <div><b>${escapeHtml(n.name)}</b> <span class="pill">${escapeHtml(n.role)}</span></div>
              <div class="small">${escapeHtml(n.blurb)}</div>
              <div class="small" style="margin-top:6px;">Bond: <b>${interactions}</b> • Tier: <b>${tier}</b></div>
            </div>
            <button class="btn primary" data-talk="${escapeHtml(n.key)}" ${state.nightActionsLeft<=0 ? "disabled":""}>Talk</button>
          </div>
          <div class="hr"></div>
          ${lastNodeHeader}
          ${lastNodeText || `<div class="small">No new camp node yet.</div>`}
          ${tier>0 ? `<div class="small" style="margin-top:6px;"><b>${escapeHtml((n.tiers||[]).find(x=>x.tier===tier)?.title || "Bond Moment")}</b> • ${escapeHtml((n.tiers||[]).find(x=>x.tier===tier)?.notes || "")}</div>`
                   : `<div class="small">No bond tier unlocked yet.</div>`}
          <div class="small" style="margin-top:8px;">${nextTier ? `Next unlock at <b>${nextTier.unlock}</b>: ${escapeHtml(nextTier.title)}` : `All tiers unlocked.`}</div>
        </div>
      `;
    };

    const prompt = getVariant(panel.prompt ?? "Camp", panel.prompt_variants, state.classKey);
    const note = panel.note ? `<div class="small">${escapeHtml(panel.note)}</div>` : "";
    container.innerHTML = `
      <div class="panel-title">${escapeHtml(prompt)}</div>
      <div class="small">Actions tonight: <b>${state.nightActionsLeft}</b>.</div>
      ${note}
      ${available.map(npcCard).join("")}
      <div class="hr"></div>
      <div class="small">Press <b>Next</b> when done.</div>
    `;

    container.querySelectorAll("[data-talk]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        if(state.nightActionsLeft <= 0) return;
        const k = btn.getAttribute("data-talk");
        const npc = npcByKey(npcs, k);
        const affinityBonus = getNpcAffinityBonus(npc, state.classKey);
        state.bonds[k] = (state.bonds[k] ?? 0) + 1 + affinityBonus;
        state.nightActionsLeft = clamp(state.nightActionsLeft - 1, 0, 99);

        // camp restores morale a bit by default; class perks can boost later
        state.stats.morale = clamp(state.stats.morale + 1, -20, 20);

        const node = npc ? pickNpcNode(npc, state) : null;
        if(node){
          const text = getVariant(node.text, node.text_variants, state.classKey);
          if(node.once !== false){
            state.seenNodes[npc.key] = state.seenNodes[npc.key] || [];
            if(!state.seenNodes[npc.key].includes(node.key)) state.seenNodes[npc.key].push(node.key);
          }
          state.lastTalk[npc.key] = { key: node.key, kind: node.kind || "Camp Node", text };
        }else if(npc){
          state.lastTalk[npc.key] = { key: "no_node", kind: "Camp Node", text: "No new stories surface tonight." };
        }

        if(affinityBonus > 0) toast("Class perk triggered.");
        toast(`You talk with ${npcByKey(npcs,k)?.name ?? k}.`);
        saveState(state);
        renderPanel(panel, ctx);
      });
    });
    return;
  }

  if(panel.kind === "death_choice"){
    const ev = resolveDeathEvent(state, panel);
    if(!ev){
      container.innerHTML = `<div class="linebox">No valid death event options.</div>`;
      return;
    }

    const optionButtons = ev.options.map(k => {
      const n = npcByKey(npcs,k);
      return `<button class="choice" data-die="${k}">${escapeHtml(n?.name ?? k)} — pull them back first</button>`;
    }).join("");

    const saveAllBtn = ev.canSaveAll
      ? `<button class="choice" data-saveall="1">Spend ${ev.costSupplies} Supplies to save everyone</button>`
      : "";

    const text = getVariant(panel.text, panel.text_variants, state.classKey);
    const intro = text ? `<div class="linebox">${escapeHtml(text)}</div>` : "";
    const prompt = getVariant(panel.prompt ?? "Death Choice", panel.prompt_variants, state.classKey);
    container.innerHTML = `
      <div class="panel-title">${escapeHtml(prompt)}</div>
      ${intro}
      <div class="linebox" style="margin-top:10px;">
        <div class="small">This event is designed to make choices matter. If you’re well-prepared, you can save all.</div>
        <div class="small">Current: Supplies <b>${state.stats.supplies}</b>, Morale <b>${state.stats.morale}</b>, Wounds <b>${state.stats.wounds}</b>, Suspicion <b>${state.stats.suspicion}</b>.</div>
        <div class="small">Thresholds: Supplies <b>${ev.minSupplies}</b>, Morale <b>${ev.minMorale}</b>.</div>
        ${ev.perkNote ? `<div class="small">${escapeHtml(ev.perkNote)}</div>` : ""}
      </div>
      <div class="choice-list" style="margin-top:10px;">
        ${saveAllBtn}
        ${optionButtons}
      </div>
      <div class="small" style="margin-top:10px;">If you don't save all, the one you don't pull back… doesn't make it.</div>
    `;

    if(ev.canSaveAll){
      container.querySelector("[data-saveall]")?.addEventListener("click", ()=>{
        state.stats.supplies = clamp(state.stats.supplies - ev.costSupplies, 0, 99);
        if(state.classKey === "architect" || state.classKey === "relicator"){
          toast("Class perk triggered.");
        }
        toast("You pay the cost. Everyone lives.");
        saveState(state);
        next(ctx);
      });
    }

    container.querySelectorAll("[data-die]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const saved = btn.getAttribute("data-die"); // we interpret: you saved this one, another dies
        const options = ev.options.slice();
        // pick the victim: most wounded context -> deterministic-ish (you can later make this a second choice)
        // victim chosen as the first different one for now
        const victim = options.find(x => x !== saved) || saved;

        // class perk: info broker can redirect danger (reduce chance chosen victim is a guide you care about)
        if(state.classKey === "infobroker" && options.length >= 2){
          // if victim is guide_2 or guide_3, swap victim to guide_1 sometimes
          if(victim !== "guide_1" && options.includes("guide_1")){
            // deterministic based on suspicion
            if(state.stats.suspicion >= 2){
              // redirect
              const newVictim = "guide_1";
              state.dead.push(newVictim);
              state.party = state.party.filter(x=>x!==newVictim);
              toast(`${npcByKey(npcs,newVictim)?.name ?? newVictim} dies. You rerouted the hunter’s attention.`);
            }else{
              state.dead.push(victim);
              state.party = state.party.filter(x=>x!==victim);
              toast(`${npcByKey(npcs,victim)?.name ?? victim} dies.`);
            }
          }else{
            state.dead.push(victim);
            state.party = state.party.filter(x=>x!==victim);
            toast(`${npcByKey(npcs,victim)?.name ?? victim} dies.`);
          }
        }else{
          state.dead.push(victim);
          state.party = state.party.filter(x=>x!==victim);
          toast(`${npcByKey(npcs,victim)?.name ?? victim} dies.`);
        }

        // death impacts morale
        const moraleLoss = panel?.death?.moraleLoss ?? 3;
        state.stats.morale = clamp(state.stats.morale - moraleLoss, -20, 20);
        saveState(state);
        next(ctx);
      });
    });

    return;
  }

  container.innerHTML = `<div class="linebox">Unknown panel kind: ${escapeHtml(panel.kind)}</div>`;
}

function next(ctx){
  const {state, panels} = ctx;
  const cur = panels[state.idx];
  if(cur?.kind === "class_select" && !state.classKey){ toast("Pick a class first."); return; }

  const nxt = panels[state.idx + 1];
  if(nxt?.kind === "camp") state.nightActionsLeft = 2;

  state.idx = Math.min(state.idx + 1, panels.length - 1);
  saveState(state);
  renderPanel(panels[state.idx], ctx);
}

function restart(){ resetState(); location.reload(); }

async function main(){
  const [classes, npcs, panels] = await Promise.all([
    loadJSON("data/classes.json"),
    loadJSON("data/npcs.json"),
    loadJSON("data/panels.json"),
  ]);

  // Minimal scenes map for badge display (optional)
  const scenesByKey = {};
  for(const p of panels){
    if(p.scene && !scenesByKey[p.scene]) scenesByKey[p.scene] = { title: p.scene };
  }
  const classesByKey = Object.fromEntries(classes.map(c => [c.key, c]));

  let state = loadState() || defaultState();
  state.flags = state.flags || {};
  state.bonds = state.bonds || {};
  state.seenNodes = state.seenNodes || {};
  state.unlockedNodes = state.unlockedNodes || { npc: {}, global: [] };
  state.lastTalk = state.lastTalk || {};
  state.stats = state.stats || { supplies: 20, morale: 10, suspicion: 0, wounds: 0 };
  state.dead = state.dead || [];
  state.party = state.party || defaultState().party.slice();
  state.idx = Number.isFinite(state.idx) ? state.idx : 0;
  if(panels.length > 0){
    state.idx = clamp(state.idx, 0, panels.length - 1);
  }else{
    state.idx = 0;
  }
  state.nightActionsLeft = Number.isFinite(state.nightActionsLeft) ? state.nightActionsLeft : 2;

  const ctx = {state, classes, npcs, panels, scenesByKey, classesByKey};

  $("#btnSkip").addEventListener("click", ()=> next(ctx));
  $("#btnRestart").addEventListener("click", restart);
  $("#btnExport").addEventListener("click", ()=> exportSave(state));
  $("#btnImport").addEventListener("click", importSave);

  saveState(state);
  renderPanel(panels[state.idx], ctx);
}

main().catch(e=>{
  console.error(e);
  document.body.innerHTML = `<pre style="color:#fff; padding:18px;">Boot error: ${String(e)}</pre>`;
});
