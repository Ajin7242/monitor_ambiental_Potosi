function entrar() {
  document.getElementById("inicio").style.display = "none";
  document.getElementById("panel").style.display = "block";
}

const client = mqtt.connect("wss://broker.emqx.io:8084/mqtt");
const contenedor = document.getElementById("contenedor");
const connStatus = document.getElementById("connStatus");

const nodos = [
  { id: 1, nombre: "Zona Norte" },
  { id: 2, nombre: "Zona Sur" },
  { id: 3, nombre: "Zona Central" },
  { id: 4, nombre: "Zona Este" }
];

const variables = ["temperatura", "humedad", "aire", "lluvia", "estado"];
const labels = {
  temperatura: "🌡️ Temperatura",
  humedad: "💧 Humedad",
  aire: "🌫️ Calidad del Aire (ppm)",
  lluvia: "🌧️ Lluvia",
  estado: "📶 Estado"
};

// Crear estructura HTML para cada nodo y métrica
nodos.forEach(nodo => {
  const nodoDiv = document.createElement("div");
  nodoDiv.className = "nodo";
  nodoDiv.innerHTML = `<h2>${nodo.nombre}</h2>`;
  variables.forEach(v => {
    const metric = document.createElement("div");
    metric.className = "metric";

    const meta = document.createElement("div");
    meta.className = "meta";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = labels[v];
    const updated = document.createElement("div");
    updated.className = "updated";
    updated.id = `updated-${v}${nodo.id}`;
    updated.textContent = "sin datos";

    meta.appendChild(label);
    meta.appendChild(updated);

    const valueWrap = document.createElement("div");
    valueWrap.style.textAlign = "right";

    const value = document.createElement("div");
    value.className = "value";
    value.id = `${v}${nodo.id}`;
    value.textContent = "--";

    // badge para estado
    if (v === "estado") {
      const badge = document.createElement("div");
      badge.className = "badge inactivo";
      badge.id = `badge-${v}${nodo.id}`;
      badge.innerHTML = `<span class="dot"></span><span id="badge-text-${v}${nodo.id}">Inactivo</span>`;
      valueWrap.appendChild(badge);
    } else {
      valueWrap.appendChild(value);
    }

    metric.appendChild(meta);
    metric.appendChild(valueWrap);
    nodoDiv.appendChild(metric);
  });
  contenedor.appendChild(nodoDiv);
});

// Suscribirse a todos los tópicos
client.on("connect", () => {
  console.log("Conectado al broker MQTT");
  connStatus.className = "conn connected";
  connStatus.textContent = "Conectado";
  nodos.forEach(nodo => {
    variables.forEach(v => {
      client.subscribe(`${v}${nodo.id}/uatf`, { qos: 0 }, (err) => {
        if (err) console.warn("Suscripción fallida:", err);
      });
    });
  });
});

client.on("reconnect", () => {
  console.log("Reconectando...");
  connStatus.className = "conn connecting";
  connStatus.textContent = "Reconectando...";
});

client.on("error", (err) => {
  console.error("Error MQTT:", err);
  connStatus.className = "conn disconnected";
  connStatus.textContent = "Error";
});

// Actualizar valores al recibir mensajes
client.on("message", (topic, message) => {
  const payloadRaw = message.toString().trim();
  // soporta IDs de más de un dígito: variable + dígitos + /uatf
  const match = topic.match(/(\w+)(\d+)\/uatf/);
  if (!match) return;
  const variable = match[1];
  const nodo = match[2];
  const elemento = document.getElementById(`${variable}${nodo}`);
  const updatedEl = document.getElementById(`updated-${variable}${nodo}`);
  const now = new Date().toLocaleTimeString();

  if (variable === "estado") {
    const isActive = payloadRaw === "1" || payloadRaw === "1.00" || payloadRaw.toLowerCase() === "on" || payloadRaw === "true";
    const badge = document.getElementById(`badge-${variable}${nodo}`);
    const badgeText = document.getElementById(`badge-text-${variable}${nodo}`);
    if (badge && badgeText) {
      badge.className = isActive ? "badge activo" : "badge inactivo";
      badgeText.textContent = isActive ? "Activo" : "Inactivo";
    }
    if (updatedEl) updatedEl.textContent = `Última actualización: ${now}`;
    return;
  }

  // intentar parsear número y formatear, si no, dejar texto crudo
  const n = parseFloat(payloadRaw.replace(",", "."));
  const formatted = Number.isFinite(n) ? (variable === "temperatura" ? `${n.toFixed(1)} °C`
    : variable === "humedad" || variable === "lluvia" ? `${n.toFixed(0)} %`
    : `${Math.round(n)} ppm`) : payloadRaw;

  if (elemento) {
    elemento.textContent = formatted;
    elemento.classList.add("change");
    setTimeout(()=> elemento.classList.remove("change"), 300);
  }
  if (updatedEl) updatedEl.textContent = `Última actualización: ${now}`;
});