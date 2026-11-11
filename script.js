"use strict";
const URL_GEOCODIFICACAO = "https://geocoding-api.open-meteo.com/v1/search";
const URL_PREVISAO = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 8000;

const CHAVE_LOCAL = "tempo:ultimo-local";
const CHAVE_UNIDADE = "tempo:unidade";

const estado = {
  local: null,         
  local2: null,
  unidade: "celsius",   
  carregando: false,
};

const $ = (id) => document.getElementById(id);
const el = {
  form: $("form-busca"),
  campo: $("campo-cidade"),
  btnLocal: $("btn-local"),
  sugestoes: $("sugestoes"),

  form2: $("form-busca-2"),
  campo2: $("campo-cidade-2"),
  btnLimparComp: $("btn-limpar-comp"),
  sugestoes2: $("sugestoes-2"),
  colunaCidade2: $("coluna-cidade-2"),

  status: $("status"),
  painel: $("painel"),
  localNome: $("local-nome"),
  localDetalhe: $("local-detalhe"),
  condicao: $("condicao"),
  tempAtual: $("temp-atual"),
  tempUnidade: $("temp-unidade"),
  sensacao: $("sensacao"),
  umidade: $("umidade"),
  vento: $("vento"),
  chuva: $("chuva"),
  nascer: $("nascer"),
  por: $("por"),

  // Elementos Cidade 2
  localNome2: $("local-nome-2"),
  localDetalhe2: $("local-detalhe-2"),
  condicao2: $("condicao-2"),
  tempAtual2: $("temp-atual-2"),
  tempUnidade2: $("temp-unidade-2"),
  sensacao2: $("sensacao-2"),
  umidade2: $("umidade-2"),
  vento2: $("vento-2"),
  chuva2: $("chuva-2"),
  nascer2: $("nascer-2"),
  por2: $("por-2"),

  listaHoras: $("lista-horas"),
  listaDias: $("lista-dias"),
  listaHoras2: $("lista-horas-2"),
  listaDias2: $("lista-dias-2"),
};

function descreverTempo(codigo, ehDia) {
  if (codigo === 0)  return { texto: "Céu limpo", icone: "☀️", tema: ehDia ? "dia-limpo" : "noite-limpa" };
  if (codigo === 1)  return { texto: "Ensolarado", icone: "🌤️", tema: ehDia ? "dia-limpo" : "noite-limpa" };
  if (codigo === 2)  return { texto: "Parcialmente nublado", icone: "⛅", tema: ehDia ? "dia-limpo" : "noite-limpa" };
  if (codigo === 3)  return { texto: "Nublado", icone: "☁️", tema: "nublado" };
  if (codigo === 45 || codigo === 48) return { texto: "Neblina", icone: "🌫️", tema: "neblina" };
  if (codigo >= 51 && codigo <= 57)   return { texto: "Garoa", icone: "🌦️", tema: "chuva" };
  if (codigo >= 61 && codigo <= 67)   return { texto: "Chuva", icone: "🌧️", tema: "chuva" };
  if (codigo >= 71 && codigo <= 77)   return { texto: "Neve", icone: "🌨️", tema: "neve" };
  if (codigo >= 80 && codigo <= 82)   return { texto: "Pancadas de chuva", icone: "🌧️", tema: "chuva" };
  if (codigo === 85 || codigo === 86) return { texto: "Pancadas de neve", icone: "🌨️", tema: "neve" };
  if (codigo >= 95)  return { texto: "Tempestade", icone: "⛈️", tema: "tempestade" };
  return { texto: "Condição desconhecida", icone: "❔", tema: ehDia ? "dia-limpo" : "noite-limpa" };
}

class ErroApp extends Error {}

async function buscarJSON(url) {
  let resposta;
  try {
    resposta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (erro) {
    if (erro.name === "TimeoutError") {
      throw new ErroApp("O serviço demorou demais para responder.");
    }
    throw new ErroApp("Não foi possível conectar ao serviço.");
  }
  if (!resposta.ok) {
    throw new ErroApp(`Erro no serviço (HTTP ${resposta.status}).`);
  }
  try {
    return await resposta.json();
  } catch {
    throw new ErroApp("Resposta inválida recebida.");
  }
}

async function buscarCidades(nome) {
  const params = new URLSearchParams({ name: nome, count: "5", language: "pt", format: "json" });
  const dados = await buscarJSON(`${URL_GEOCODIFICACAO}?${params}`);
  return (dados.results || []).map((r) => ({
    nome: r.name,
    detalhe: [r.admin1, r.country].filter(Boolean).join(", "),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

async function buscarPrevisao(local, unidade) {
  const params = new URLSearchParams({
    latitude: local.latitude,
    longitude: local.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    hourly: "temperature_2m,weather_code,precipitation_probability,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    timezone: "auto",
    forecast_days: "7",
    temperature_unit: unidade,
    wind_speed_unit: unidade === "fahrenheit" ? "mph" : "kmh",
  });
  const dados = await buscarJSON(`${URL_PREVISAO}?${params}`);
  if (!dados.current || !dados.hourly || !dados.daily) {
    throw new ErroApp("Previsão incompleta.");
  }
  return dados;
}

const arredondar = (n) => Math.round(n);
const hhmm = (iso) => iso.slice(11, 16);

function mostrarStatus(mensagem, ehErro = false) {
  el.status.textContent = mensagem;
  el.status.classList.toggle("erro", ehErro);
}

function renderizar(dados, local) {
  const atual = dados.current;
  const unidadeTemp = dados.current_units.temperature_2m;      
  const unidadeVento = dados.current_units.wind_speed_10m;      
  const clima = descreverTempo(atual.weather_code, atual.is_day === 1);

  document.body.dataset.tema = clima.tema;

  el.localNome.textContent = local.nome;
  el.localDetalhe.textContent = local.detalhe || "";
  el.condicao.textContent = `${clima.icone} ${clima.texto}`;
  el.tempAtual.textContent = arredondar(atual.temperature_2m);
  el.tempUnidade.textContent = unidadeTemp;
  el.sensacao.textContent = `${arredondar(atual.apparent_temperature)}${unidadeTemp}`;
  el.umidade.textContent = `${atual.relative_humidity_2m}%`;
  el.vento.textContent = `${arredondar(atual.wind_speed_10m)} ${unidadeVento}`;
  el.chuva.textContent = `${atual.precipitation} mm`;
  el.nascer.textContent = hhmm(dados.daily.sunrise[0]);
  el.por.textContent = hhmm(dados.daily.sunset[0]);

  renderizarHoras(dados, unidadeTemp, el.listaHoras);
  renderizarDias(dados, unidadeTemp, el.listaDias);

  el.painel.hidden = false;
}

function renderizarCidade2(dados, local) {
  const atual = dados.current;
  const unidadeTemp = dados.current_units.temperature_2m;      
  const unidadeVento = dados.current_units.wind_speed_10m;      
  const clima = descreverTempo(atual.weather_code, atual.is_day === 1);

  el.localNome2.textContent = local.nome;
  el.localDetalhe2.textContent = local.detalhe || "";
  el.condicao2.textContent = `${clima.icone} ${clima.texto}`;
  el.tempAtual2.textContent = arredondar(atual.temperature_2m);
  el.tempUnidade2.textContent = unidadeTemp;
  el.sensacao2.textContent = `${arredondar(atual.apparent_temperature)}${unidadeTemp}`;
  el.umidade2.textContent = `${atual.relative_humidity_2m}%`;
  el.vento2.textContent = `${arredondar(atual.wind_speed_10m)} ${unidadeVento}`;
  el.chuva2.textContent = `${atual.precipitation} mm`;
  el.nascer2.textContent = hhmm(dados.daily.sunrise[0]);
  el.por2.textContent = hhmm(dados.daily.sunset[0]);

  renderizarHoras(dados, unidadeTemp, el.listaHoras2);
  renderizarDias(dados, unidadeTemp, el.listaDias2);

  document.querySelector(".p3-grid-comparacao").classList.add("comparando");
  document.querySelector(".app").classList.add("modo-comparacao");
  el.colunaCidade2.hidden = false;
  el.btnLimparComp.hidden = false;
}

function renderizarHoras(dados, unidadeTemp, elementoAlvo) {
  const h = dados.hourly;
  const prefixo = dados.current.time.slice(0, 13);
  let inicio = h.time.findIndex((t) => t.startsWith(prefixo));
  if (inicio < 0) inicio = 0;

  elementoAlvo.replaceChildren();
  for (let i = inicio; i < inicio + 24 && i < h.time.length; i++) {
    const clima = descreverTempo(h.weather_code[i], h.is_day[i] === 1);
    const prob = h.precipitation_probability[i];

    const li = document.createElement("li");
    li.innerHTML = '<span class="hora"></span><span class="icone"></span><strong class="valor"></strong><span class="chuva-prob"></span>';
    li.querySelector(".hora").textContent = hhmm(h.time[i]);
    li.querySelector(".icone").textContent = clima.icone;
    li.querySelector(".icone").title = clima.texto;
    li.querySelector(".valor").textContent = `${arredondar(h.temperature_2m[i])}°`;
    li.querySelector(".chuva-prob").textContent = prob >= 20 ? `${prob}%` : "";
    elementoAlvo.append(li);
  }
}

function renderizarDias(dados, unidadeTemp, elementoAlvo) {
  const d = dados.daily;
  const formatoDia = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

  elementoAlvo.replaceChildren();
  d.time.forEach((dataISO, i) => {
    const clima = descreverTempo(d.weather_code[i], true);
    const nomeDia = i === 0 ? "hoje" : i === 1 ? "amanhã" : formatoDia.format(new Date(`${dataISO}T12:00:00`));
    const prob = d.precipitation_probability_max[i];

    const li = document.createElement("li");
    li.innerHTML =
      '<span class="dia-semana"></span><span class="icone"></span>' +
      '<span class="dia-chuva"></span>' +
      '<span class="faixa"><span class="min"></span> / <strong class="max"></strong></span>';
    li.querySelector(".dia-semana").textContent = nomeDia;
    li.querySelector(".icone").textContent = clima.icone;
    li.querySelector(".icone").title = clima.texto;
    li.querySelector(".dia-chuva").textContent = `${clima.texto}${prob != null ? ` · ${prob}%` : ""}`;
    li.querySelector(".min").textContent = `${arredondar(d.temperature_2m_min[i])}°`;
    li.querySelector(".max").textContent = `${arredondar(d.temperature_2m_max[i])}${unidadeTemp}`;
    elementoAlvo.append(li);
  });
}

function guardar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch {} }
function ler(chave) { try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; } }

function definirCarregando(ligado) {
  estado.carregando = ligado;
  document.querySelectorAll("button").forEach((b) => (b.disabled = ligado));
}

async function carregarLocal(local) {
  esconderSugestoes();
  definirCarregando(true);
  mostrarStatus(`CARREGANDO PREVISÃO DE ${local.nome}…`);
  try {
    const dados = await buscarPrevisao(local, estado.unidade);
    estado.local = local;
    guardar(CHAVE_LOCAL, local);
    renderizar(dados, local);
    
    if (estado.local2) {
      await carregarCidade2(estado.local2);
    }
    
    mostrarStatus(`ATUALIZADO ÀS ${hhmm(dados.current.time)} (${local.nome}).`);
  } catch (erro) {
    mostrarStatus(erro instanceof ErroApp ? erro.message : "Algo deu errado.", true);
  } finally {
    definirCarregando(false);
  }
}

async function carregarCidade2(local) {
  esconderSugestoes();
  definirCarregando(true);
  try {
    const dados = await buscarPrevisao(local, estado.unidade);
    estado.local2 = local;
    renderizarCidade2(dados, local);
  } catch (erro) {
    mostrarStatus(erro instanceof ErroApp ? erro.message : "Erro na comparação.", true);
  } finally {
    definirCarregando(false);
  }
}

function fecharComparacao() {
  estado.local2 = null;
  el.colunaCidade2.hidden = true;
  el.btnLimparComp.hidden = true;
  el.campo2.value = "";
  document.querySelector(".p3-grid-comparacao").classList.remove("comparando");
  document.querySelector(".app").classList.remove("modo-comparacao");
}

function esconderSugestoes() {
  el.sugestoes.hidden = true;
  el.sugestoes.replaceChildren();
  if (el.sugestoes2) {
    el.sugestoes2.hidden = true;
    el.sugestoes2.replaceChildren();
  }
}

function mostrarSugestoes(cidades, ehCidade2 = false) {
  const alvo = ehCidade2 ? el.sugestoes2 : el.sugestoes;
  alvo.replaceChildren();
  cidades.forEach((cidade) => {
    const li = document.createElement("li");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = cidade.detalhe ? `${cidade.nome} — ${cidade.detalhe}` : cidade.nome;
    botao.addEventListener("click", () => ehCidade2 ? carregarCidade2(cidade) : carregarLocal(cidade));
    li.append(botao);
    alvo.append(li);
  });
  alvo.hidden = false;
}

async function aoBuscar(evento) {
  evento.preventDefault();
  const termo = el.campo.value.trim();
  if (termo.length < 2) return;
  esconderSugestoes();
  definirCarregando(true);
  try {
    const cidades = await buscarCidades(termo);
    definirCarregando(false);
    if (cidades.length === 1) {
      carregarLocal(cidades[0]);
    } else if (cidades.length > 1) {
      mostrarSugestoes(cidades, false);
    }
  } catch (erro) {
    definirCarregando(false);
  }
}

async function aoBuscarCidade2(evento) {
  evento.preventDefault();
  if (!estado.local) return;
  const termo = el.campo2.value.trim();
  if (termo.length < 2) return;
  
  esconderSugestoes();
  definirCarregando(true);
  try {
    const cidades = await buscarCidades(termo);
    definirCarregando(false);
    if (cidades.length === 1) {
      carregarCidade2(cidades[0]);
    } else if (cidades.length > 1) {
      mostrarSugestoes(cidades, true);
    }
  } catch (erro) {
    definirCarregando(false);
  }
}

function aoUsarLocalizacao() {
  if (!("geolocation" in navigator)) return;
  mostrarStatus("OBTENDO SUA LOCALIZAÇÃO…");
  navigator.geolocation.getCurrentPosition(
    (pos) => carregarLocal({
      nome: "Sua localização",
      detalhe: "",
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    }),
    () => mostrarStatus("NÃO FOI POSSÍVEL OBTER A LOCALIZAÇÃO.", true),
    { timeout: 10000 }
  );
}

function aoTrocarUnidade(evento) {
  const botao = evento.target.closest("button[data-unidade]");
  if (!botao || botao.dataset.unidade === estado.unidade) return;
  definirUnidade(botao.dataset.unidade);
  if (estado.local) carregarLocal(estado.local);
}

function definirUnidade(unidade) {
  estado.unidade = unidade;
  guardar(CHAVE_UNIDADE, unidade);
  document.querySelectorAll("button[data-unidade]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.unidade === unidade));
  });
}

el.form.addEventListener("submit", aoBuscar);
el.form2.addEventListener("submit", aoBuscarCidade2);
el.btnLimparComp.addEventListener("click", fecharComparacao);
el.btnLocal.addEventListener("click", aoUsarLocalizacao);
document.querySelector(".unidades").addEventListener("click", aoTrocarUnidade);

const unidadeSalva = ler(CHAVE_UNIDADE);
if (unidadeSalva === "celsius" || unidadeSalva === "fahrenheit") definirUnidade(unidadeSalva);

const localSalvo = ler(CHAVE_LOCAL);
if (localSalvo && typeof localSalvo.latitude === "number" && typeof localSalvo.longitude === "number") {
  carregarLocal(localSalvo);
}