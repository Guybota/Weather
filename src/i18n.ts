export type Language = 'pt' | 'en';
export function languageFor(language: string): Language {
  return /^pt(?:-|$)/i.test(language) ? 'pt' : 'en';
}
export function language(): Language {
  return typeof navigator === 'undefined' ? 'pt' : languageFor(navigator.language);
}
export function locale(): string {
  return language() === 'pt' ? 'pt-PT' : 'en-GB';
}
const messages: Record<string, string> = {
  'O IPMA disponibiliza apenas previsão diária para este dia. Consulta o resumo diário.':
    'IPMA only provides a daily forecast for this day. See the daily summary.',
  'Não está prevista chuva nos períodos restantes disponíveis.':
    'No rain is forecast in the remaining available periods.',
  'O catálogo de localidades está indisponível.': 'The location catalogue is unavailable.',
  'A previsão diária está indisponível.': 'The daily forecast is unavailable.',
  'Não foi possível contactar o IPMA.': 'Could not reach IPMA.',
  Portugal: 'Portugal',
  'Tempo, início': 'Tempo, home',
  'Pesquisar localidade': 'Search locations',
  'Lisboa, Porto, Funchal…': 'Lisbon, Porto, Funchal…',
  'Nenhuma localidade encontrada.': 'No locations found.',
  'Usar a minha localização': 'Use my location',
  'A localizar…': 'Locating…',
  'Os teus locais': 'Your places',
  'Localidades favoritas': 'Favourite locations',
  Reordenar: 'Reorder',
  Concluir: 'Done',
  'Previsão diária indisponível': 'Daily forecast unavailable',
  Hoje: 'Today',
  guardado: 'saved',
  'Usa a estrela junto ao nome da localidade para guardar o primeiro local.':
    'Tap the star next to a location to save your first place.',
  'Dados oficiais do IPMA': 'Official IPMA data',
  'Visitar o IPMA': 'Visit IPMA',
  'Portugal continental': 'Mainland Portugal',
  Açores: 'Azores',
  Madeira: 'Madeira',
  'Guardar nos favoritos': 'Save to favourites',
  'Remover dos favoritos': 'Remove from favourites',
  'Atualizar dados': 'Refresh data',
  'Instalar app': 'Install app',
  Personalizar: 'Customise',
  'Tema do sistema': 'System appearance',
  'Está disponível uma nova versão.': 'A new version is available.',
  'Atualizar app': 'Update app',
  'Sem ligação. Os dados guardados podem estar desatualizados.':
    'Offline. Saved data may be out of date.',
  'Fechar mensagem': 'Dismiss message',
  'Tentar novamente': 'Try again',
  'O tempo em Portugal': 'Weather in Portugal',
  'A obter a previsão do IPMA.': 'Fetching the IPMA forecast.',
  'A carregar a previsão…': 'Loading the forecast…',
  'Resumo do tempo': 'Weather overview',
  'Temperatura observada': 'Observed temperature',
  'Temperatura prevista': 'Forecast temperature',
  'Máx.': 'High',
  'Mín.': 'Low',
  'Previsão do dia': 'Daily forecast',
  'Condição prevista': 'Forecast conditions',
  'Sem temperatura recente disponível.': 'No recent temperature available.',
  'Previsão diária do IPMA': 'IPMA daily forecast',
  'Para planear o dia': 'Plan your day',
  'Resumo dos períodos disponíveis no IPMA.': 'Summary of the periods available from IPMA.',
  'Indicadores de hoje': 'Today’s details',
  Vento: 'Wind',
  Humidade: 'Humidity',
  'Índice UV': 'UV index',
  Pressão: 'Pressure',
  Chuva: 'Rain',
  'Vento previsto': 'Forecast wind',
  'Humidade observada': 'Observed humidity',
  'Humidade prevista': 'Forecast humidity',
  'Índice UV previsto': 'Forecast UV index',
  'Pressão observada': 'Observed pressure',
  'Probabilidade de chuva': 'Chance of rain',
  'Para hoje': 'For today',
  'Para a localidade': 'For this location',
  'Direção indisponível': 'Direction unavailable',
  'Sem informação': 'No data',
  'Sem observação recente': 'No recent observation',
  'Sem previsão recente disponível.': 'No recent forecast available.',
  'Sem informação recente disponível.': 'No recent data available.',
  Baixo: 'Low',
  Moderado: 'Moderate',
  Elevado: 'High',
  'Muito elevado': 'Very high',
  Extremo: 'Extreme',
  'Avisos meteorológicos': 'Weather warnings',
  'Avisos indisponíveis': 'Warnings unavailable',
  'Avisos guardados — confirmar atualização': 'Saved warnings — check for updates',
  'Sem avisos em vigor ou previstos': 'No active or upcoming warnings',
  'Não foi possível confirmar os avisos atuais. Consulta o IPMA.':
    'Current warnings could not be verified. Check IPMA.',
  'Avisos oficiais para a região da localidade selecionada.':
    'Official warnings for this location’s region.',
  'Consultar avisos no IPMA': 'View warnings on IPMA',
  Vermelho: 'Red',
  Laranja: 'Orange',
  Amarelo: 'Yellow',
  Previsto: 'Upcoming',
  'Em vigor': 'Active',
  até: 'until',
  Precipitação: 'Rainfall',
  Trovoada: 'Thunderstorms',
  'Agitação Marítima': 'Coastal waves',
  Neve: 'Snow',
  Nevoeiro: 'Fog',
  'Tempo Quente': 'Hot weather',
  'Tempo Frio': 'Cold weather',
  'Texto oficial do IPMA em português.': 'Official IPMA warning text in Portuguese.',
  'Ao longo do dia': 'Throughout the day',
  'Dia do gráfico': 'Chart day',
  'Consulta o detalhe ao tocar num dia.': 'Tap a day to explore the details.',
  'Temperaturas mínima e máxima (°C). Chuva: probabilidade diária (%).':
    'Daily low and high (°C). Rain: daily probability (%).',
  Temperatura: 'Temperature',
  'Métrica do gráfico': 'Chart metric',
  'Previsão horária': 'Hourly forecast',
  'Estimativa entre previsões': 'Estimate between forecasts',
  'Sem dados entre pontos': 'Missing values between points',
  'Pontos: valores do IPMA. Tracejado: horas sem valor. Toca ou arrasta para consultar; “—” significa sem dados.':
    'Dots: IPMA values. Dashed lines: hours without values. Tap or drag to explore; “—” means no data.',
  'Intervalo de 3 horas': '3-hour interval',
  Agora: 'Now',
  'Hora da previsão': 'Forecast time',
  'Selecionar hora': 'Select time',
  'Toca ou arrasta no gráfico. As setas do teclado também mudam a hora. “—” indica um valor não fornecido pelo IPMA.':
    'Tap or drag on the chart. Use the arrow keys to change the time. “—” means IPMA has not supplied a value.',
  'Este parâmetro não está disponível para o dia selecionado.':
    'This measurement is unavailable for the selected day.',
  'O IPMA disponibiliza apenas previsão diária para este dia. Consulta os valores abaixo.':
    'IPMA only provides a daily forecast for this day. See the daily values below.',
  Mínima: 'Low',
  Máxima: 'High',
  Anterior: 'Previous',
  Seguinte: 'Next',
  'Detalhe do dia': 'Day details',
  'Fonte:': 'Source:',
  'Horas locais dos Açores.': 'Azores local time.',
  'Horas locais de Portugal continental e Madeira.': 'Mainland Portugal and Madeira local time.',
  'Aplicação independente. Previsões sujeitas a alteração.':
    'Independent app. Forecasts may change.',
  'Detalhe horário e disponibilidade dos parâmetros variam com o horizonte.':
    'Hourly detail and available measurements vary with the forecast horizon.',
  'Fechar painel': 'Close panel',
  'Direção do vento indisponível': 'Wind direction unavailable',
  'Personaliza o teu resumo': 'Customise your overview',
  'Escolhe os indicadores e a ordem em que aparecem.':
    'Choose the details and the order they appear in.',
  'Indicadores visíveis': 'Visible details',
  'Repor indicadores': 'Reset details',
  'A língua e o tema seguem o sistema.': 'Language and appearance follow your system.',
  Português: 'Portuguese',
  Inglês: 'English',
  Claro: 'Light',
  Escuro: 'Dark',
  Idioma: 'Language',
  Aparência: 'Appearance',
  'O tempo no teu ecrã principal': 'Weather on your home screen',
  'No iPhone:': 'On iPhone:',
  'No Android:': 'On Android:',
  'abre esta página no Safari, toca em Partilhar e escolhe “Adicionar ao ecrã principal”.':
    'open this page in Safari, tap Share and choose “Add to Home Screen”.',
  'Ativa “Abrir como app web”, se disponível.': 'Enable “Open as Web App”, if available.',
  'abre o menu do Chrome e escolhe “Instalar aplicação” ou “Adicionar ao ecrã principal”.':
    'open the Chrome menu and choose “Install app” or “Add to Home Screen”.',
  Entendido: 'Got it',
  'Fechar instruções': 'Close instructions',
  Locais: 'Places',
  '10 dias': '10 days',
  'Previsão diária': 'Daily forecast',
  'dados guardados': 'saved data',
  'Consulta os períodos disponíveis para planear o teu dia.':
    'Explore the available periods to plan your day.',
  'A app foi instalada.': 'The app has been installed.',
  'Não foi possível obter a previsão.': 'Could not fetch the forecast.',
  'Não foi possível obter as localidades.': 'Could not fetch locations.',
  'Não foi possível atualizar os dados do IPMA.': 'Could not refresh IPMA data.',
  'Resposta inválida do IPMA.': 'Invalid response from IPMA.',
  'O formato dos dados do IPMA mudou.': 'The IPMA data format has changed.',
  'Este browser não disponibiliza localização. Pesquisa uma localidade.':
    'This browser does not support location. Search for a place.',
  'A app cobre Portugal. Pesquisa uma localidade portuguesa.':
    'This app covers Portugal. Search for a Portuguese location.',
  'Não foi possível obter a localização. Podes pesquisar uma localidade.':
    'Could not find your location. You can search for a place.',
  'Sem informação disponível.': 'No data available.',
  'Velocidade e direção previstas para a localidade. A direção indica de onde vem o vento. Não representa rajadas.':
    'Forecast wind speed and direction for this location. The direction shows where the wind comes from. This is not a gust forecast.',
  'A percentagem indica a probabilidade de precipitação durante o período previsto. Não é a quantidade de chuva nem a percentagem do dia em que vai chover. Os valores de cada período e do dia completo podem diferir.':
    'The percentage indicates the chance of precipitation during the forecast period. It is not the amount of rain or the proportion of the day with rainfall. Individual periods and the full day can have different probabilities.',
  'Previsão diária do IPMA. No gráfico, cada valor corresponde ao período disponibilizado.':
    'IPMA daily forecast. Each value on the chart corresponds to the supplied forecast period.',
  'O índice UV descreve a intensidade da radiação ultravioleta prevista. A escala vai de baixo (0–2) a extremo (11 ou mais). Este é o valor diário disponibilizado pelo IPMA; não é uma medição em tempo real.':
    'The UV index describes forecast ultraviolet radiation intensity. The scale runs from low (0–2) to extreme (11 or higher). This is the daily value supplied by IPMA, not a live measurement.',
  'Previsão diária para hoje.': 'Daily forecast for today.',
  'A humidade relativa compara o vapor de água presente no ar com o máximo possível à mesma temperatura. Um valor de 100% não implica, por si só, que esteja a chover.':
    'Relative humidity compares the water vapour in the air with the maximum possible at the same temperature. A value of 100% does not, on its own, mean it is raining.',
  'Pressão atmosférica registada pela estação meteorológica próxima. O valor é apresentado em hectopascais (hPa), sem inferir uma tendência a partir de uma única observação.':
    'Atmospheric pressure recorded by the nearby weather station, in hectopascals (hPa). A single reading does not establish a trend.',
  'Não há uma observação adequada disponível.': 'No suitable observation is available.',
};
const patterns: [RegExp, (...matches: string[]) => string][] = [
  [
    /^(.+), às (.+)$/,
    (name, time) => `${name}, at ${time.replace('dados guardados', 'saved data')}`,
  ],
  [/^(.+) · dados guardados$/, (name) => `${name} · saved data`],
  [/^Reordenar (.+)$/, (name) => `Reorder ${name}`],
  [/^Subir (.+)$/, (name) => `Move ${name} up`],
  [/^Descer (.+)$/, (name) => `Move ${name} down`],
  [/^Vem de (.+)$/, (direction) => `From ${direction}`],
  [/^O vento vem de (.+)$/, (direction) => `Wind comes from ${direction}`],
  [/^Às (.+)$/, (time) => `At ${time}`],
  [
    /^Previsão para as (.+)\. Sem observação recente próxima\.$/,
    (time) => `Forecast for ${time}. No recent nearby observation.`,
  ],
  [/^Previsão para as (.+)$/, (time) => `Forecast for ${time}`],
  [
    /^Previsão para (.+), a localidade disponível mais próxima\.$/,
    (name) => `Forecast for ${name}, the nearest available location.`,
  ],
  [
    /^(.+), a (.+) · (.+)$/,
    (name, distance, time) =>
      `${name}, ${distance} away · ${time.replace('dados guardados', 'saved data')}`,
  ],
  [/^(\d+) aviso(s?) para a região$/, (n, s) => `${n} warning${s ? 's' : ''} for this region`],
  [/^Próximos (\d+) dias$/, (n) => `Next ${n} days`],
  [/^Previsão atualizada às (.+)$/, (time) => `Forecast updated at ${time}`],
  [
    /^Maior probabilidade de chuva às (.+): (.+)\.$/,
    (time, chance) => `Highest chance of rain at ${time}: ${chance}.`,
  ],
  [
    /^Vento mais intenso às (.+): (.+)\.$/,
    (time, speed) => `Strongest forecast wind at ${time}: ${speed}.`,
  ],
  [
    /^Probabilidade de chuva até (.+) nos períodos restantes disponíveis\.$/,
    (chance) => `Up to ${chance} chance of rain in the remaining available periods.`,
  ],
  [
    /^Hoje, temperaturas entre (.+) e (.+)\.$/,
    (low, high) => `Today, temperatures from ${low} to ${high}.`,
  ],
];
export function t(text: string): string {
  if (language() === 'pt') return text;
  if (messages[text]) return messages[text];
  for (const [pattern, convert] of patterns) {
    const match = text.match(pattern);
    if (match) return convert(...match.slice(1));
  }
  return text;
}
