const base = 'https://api.ipma.pt/';
const locations = await fetch(base + 'public-data/forecast/locations.json').then((r) => r.json());
for (const name of ['Lisboa', 'Funchal', 'Ponta Delgada']) {
  const location = locations.find((l) => l.local === name);
  if (!location) throw new Error(`Local não encontrado: ${name}`);
  const response = await fetch(
    `${base}public-data/forecast/aggregate/${location.globalIdLocal}.json`,
  );
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const forecast = await response.json();
  const daily = forecast.filter((p) => p.idPeriodo === 24);
  if (!daily.length || !forecast.some((p) => [1, 3].includes(p.idPeriodo)))
    throw new Error(`${name}: previsão incompleta`);
  console.log(
    `${name}: região ${location.idRegiao}, ${daily.length} dias, ${forecast.filter((p) => p.idPeriodo === 1).length} períodos horários, ${forecast.filter((p) => p.idPeriodo === 3).length} períodos de 3h`,
  );
}
const warnings = await fetch(base + 'public-data/warnings/warnings_www.json').then((r) => r.json());
if (!Array.isArray(warnings.data)) throw new Error('Formato dos avisos mudou.');
console.log(`Avisos: ${warnings.data.length} registos. Catálogo: ${locations.length} localidades.`);
